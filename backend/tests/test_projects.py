import base64

import httpx
import pytest

from app.db import SessionLocal
from app.models import Evidence, GithubAccount
from app.services import github as gh
from tests.conftest import register
from tests.test_readiness import create_target

TREE = [
    {"path": "README.md", "type": "blob", "size": 900},
    {"path": "package.json", "type": "blob", "size": 400},
    {"path": "package-lock.json", "type": "blob", "size": 90000},
    {"path": ".github/workflows/ci.yml", "type": "blob", "size": 300},
    {"path": "src/App.tsx", "type": "blob", "size": 4000},
    {"path": "src/api/client.ts", "type": "blob", "size": 3000},
    {"path": "src/components/Button.tsx", "type": "blob", "size": 1500},
    {"path": "src/components/Card.tsx", "type": "blob", "size": 1500},
    {"path": "src/components/Modal.tsx", "type": "blob", "size": 1500},
    {"path": "src/components/Table.tsx", "type": "blob", "size": 1500},
    {"path": "src/__tests__/App.test.tsx", "type": "blob", "size": 1200},
    {"path": "node_modules/react/index.js", "type": "blob", "size": 2000},
    {"path": "dist/bundle.min.js", "type": "blob", "size": 30000},
    {"path": "scripts/huge.ts", "type": "blob", "size": 90000},
]


def fake_github(repo_overrides=None, contributors=None, tree=TREE):
    meta = {"full_name": "janedoe/shop", "html_url": "https://github.com/janedoe/shop", "private": False,
            "fork": False, "default_branch": "main", "description": "A shop", "stargazers_count": 3,
            "forks_count": 0, "pushed_at": "2026-09-01T00:00:00Z", "owner": {"login": "janedoe"},
            **(repo_overrides or {})}
    requests = []

    def handler(req: httpx.Request) -> httpx.Response:
        path = req.url.path
        requests.append(path)
        if path == "/repos/janedoe/shop":
            return httpx.Response(200, json=meta)
        if path == "/repos/nobody/missing":
            return httpx.Response(404, json={"message": "Not Found"})
        if path.endswith("/branches/main"):
            return httpx.Response(200, json={"commit": {"sha": "abc123"}})
        if "/git/trees/abc123" in path:
            return httpx.Response(200, json={"tree": tree})
        if path.endswith("/languages"):
            return httpx.Response(200, json={"TypeScript": 9000})
        if path.endswith("/contributors"):
            return httpx.Response(200, json=contributors or [{"login": "janedoe", "contributions": 40}])
        if "/contents/" in path:
            file_path = path.split("/contents/", 1)[1]
            body = f"// {file_path}\nexport const x = 1;\n"
            return httpx.Response(200, json={"content": base64.b64encode(body.encode()).decode()})
        return httpx.Response(404)

    return handler, requests


@pytest.fixture
def github_api(monkeypatch):
    state = {}

    def install(**kw):
        handler, requests = fake_github(**kw)
        state["requests"] = requests
        monkeypatch.setattr(gh, "http_client", lambda: httpx.Client(transport=httpx.MockTransport(handler)))
        return requests

    install()
    state["install"] = install
    return state


def review_payload(skills=(("React", 80), ("TypeScript", 70))):
    dims = ("code_quality", "architecture", "testing", "documentation", "security", "best_practices")
    rubric = [{"dimension": d, "score": 7, "evidence": "src/App.tsx", "improvement": "x"} for d in dims]
    return {"project_type": "React SPA", "summary": "Solid.", "overall_score": 120, "rubric": rubric,
            "skills": [{"skill": s, "level": "solid", "score": sc, "evidence": "src/App.tsx"}
                       for s, sc in skills],
            "highlights": ["CI"], "improvements": ["More tests"], "talking_points": ["State management"]}


def link_github(user_id, login="janedoe"):
    with SessionLocal() as db:
        db.add(GithubAccount(user_id=user_id, github_id=1, login=login))
        db.commit()


def test_parse_repo_url():
    assert gh.parse_repo_url("https://github.com/janedoe/shop") == ("janedoe", "shop")
    assert gh.parse_repo_url("github.com/janedoe/shop.git") == ("janedoe", "shop")
    assert gh.parse_repo_url("https://github.com/janedoe/shop/tree/main/src") == ("janedoe", "shop")
    assert gh.parse_repo_url("janedoe/shop") == ("janedoe", "shop")
    for bad in ("https://gitlab.com/x", "not a url", "https://github.com/onlyowner"):
        with pytest.raises(gh.GithubError):
            gh.parse_repo_url(bad)


def test_select_files_skips_noise_and_spreads_sample():
    sel = gh.select_files(TREE)
    files = sel["files"]
    assert files[:2] == ["README.md", "package.json"] and ".github/workflows/ci.yml" in files
    assert not any(f.startswith(("node_modules", "dist")) or f == "package-lock.json" for f in files)
    assert "scripts/huge.ts" not in files  # over the size limit
    assert sum(1 for f in files if f.startswith("src/components/")) == 3  # max 3 per folder
    assert "src/__tests__/App.test.tsx" in files and sel["test_files"] == 1


def test_ownership_statuses():
    snap = {"owner_login": "JaneDoe", "fork": False,
            "contributors": [{"login": "janedoe", "contributions": 30},
                             {"login": "bob", "contributions": 10}]}
    assert gh.ownership(snap, None)["status"] == "not_verified"
    assert gh.ownership(snap, "janedoe")["status"] == "owner"
    team = {**snap, "owner_login": "acme"}
    got = gh.ownership(team, "janedoe")
    assert (got["status"], got["commits"], got["sharePct"]) == ("contributor", 30, 75)
    assert gh.ownership(team, "mallory")["status"] == "not_verified"
    assert gh.ownership({**snap, "fork": True, "contributors": []}, "janedoe")["status"] == "not_verified"


def test_review_flow_records_evidence(client, user, fake_llm, github_api):
    create_target(client, fake_llm)  # React / TypeScript requirements
    link_github(user["id"])
    fake_llm.push(review_payload())
    r = client.post("/api/projects/review", json={"repo_url": "https://github.com/janedoe/shop"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["overallScore"] == 100 and body["commitUrl"].endswith("/tree/abc123")
    assert body["ownership"]["status"] == "owner"
    assert "package-lock.json" not in body["meta"]["filesReviewed"]
    prompt = fake_llm.calls[-1][1]["prompt"]
    assert '<file path="src/App.tsx">' in prompt and "Requirement names" in prompt and "React" in prompt
    assert client.get("/api/auth/me").json()["credits"] == 10 - 2 - 5
    with SessionLocal() as db:
        ev = {(e.requirement_key, e.score) for e in db.query(Evidence).filter(Evidence.source == "project")}
    assert ev == {("react", 80), ("typescript", 70)}
    listed = client.get("/api/projects").json()["reviews"]
    assert listed[0]["repo"] == "janedoe/shop" and listed[0]["ownership"] == "owner"


def test_unverified_without_github(client, user, fake_llm, github_api):
    fake_llm.push(review_payload())
    body = client.post("/api/projects/review", json={"repo_url": "janedoe/shop"}).json()
    assert body["ownership"]["status"] == "not_verified"


def test_github_failures_are_not_charged(client, user, fake_llm, github_api):
    for url in ("https://example.com/x", "nobody/missing"):
        r = client.post("/api/projects/review", json={"repo_url": url})
        assert r.status_code == 400
    github_api["install"](repo_overrides={"private": True})
    assert client.post("/api/projects/review", json={"repo_url": "janedoe/shop"}).status_code == 400
    github_api["install"](tree=[{"path": "README.md", "type": "blob", "size": 10}])
    r = client.post("/api/projects/review", json={"repo_url": "janedoe/shop"})
    assert r.status_code == 400 and "No reviewable source" in r.json()["detail"]
    assert client.get("/api/auth/me").json()["credits"] == 10 and fake_llm.calls == []


def test_reviews_are_private_and_deletable(client, user, fake_llm, github_api):
    fake_llm.push(review_payload())
    rid = client.post("/api/projects/review", json={"repo_url": "janedoe/shop"}).json()["id"]
    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    assert client.get(f"/api/projects/{rid}").status_code == 404
    assert client.delete(f"/api/projects/{rid}").status_code == 404
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"email": "ada@example.com", "password": "correct-horse-1"})
    assert client.delete(f"/api/projects/{rid}").status_code == 204


def test_schema_is_strict_compatible():
    from openai.lib._parsing._responses import type_to_text_format_param

    from app.services.project_review import ProjectReviewLLM

    assert type_to_text_format_param(ProjectReviewLLM)["strict"] is True
