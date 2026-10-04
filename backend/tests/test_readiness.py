import io

from app.db import SessionLocal
from app.models import Evidence, TargetRole
from app.services import readiness
from tests.conftest import register

RESUME = ("Jane Doe\njane@example.com\nSoftware Engineer at Acme. Built React dashboards and "
          "REST APIs in Python. Wrote unit tests with pytest.\n") * 2


def req(name, status="unknown", must=True, weight=3, aliases=(), kind="skill"):
    return {"name": name, "kind": kind, "weight": weight, "must_have": must, "aliases": list(aliases),
            "baseline_status": status, "baseline_evidence": "seen" if status != "unknown" else ""}


def requirement_map(with_resume=False):
    s = (lambda st: st) if with_resume else (lambda st: "unknown")
    return {"summary": "Builds web apps", "requirements": [
        req("React", s("met"), aliases=["ReactJS", "react.js"]),
        req("TypeScript", s("missing"), aliases=["ts"]),
        req("REST API design", s("partial"), weight=2),
        req("React", s("met")),  # duplicate is dropped
        req("Code review", s("unknown"), must=False, weight=1, kind="practice"),
    ]}


def create_target(client, fake_llm, title="Frontend Engineer", with_resume=False, jd=""):
    fake_llm.push(requirement_map(with_resume))
    files = {"resume": ("cv.txt", io.BytesIO(RESUME.encode()), "text/plain")} if with_resume else None
    r = client.post("/api/readiness/targets", data={"title": title, "job_description": jd}, files=files)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_target_without_resume(client, user, fake_llm):
    target = create_target(client, fake_llm)
    keys = [r["key"] for r in target["requirements"]]
    assert keys == ["react", "typescript", "rest-api-design", "code-review"]
    react = target["requirements"][0]
    assert react["aliases"] == ["react js", "reactjs"]  # normalised, name itself excluded
    assert target["isActive"] is True
    assert client.get("/api/auth/me").json()["credits"] == 8
    with SessionLocal() as db:
        assert db.query(Evidence).count() == 0
    prompt = fake_llm.calls[0][1]["prompt"]
    assert "<resume>" not in prompt


def test_create_target_with_resume_records_baseline(client, user, fake_llm):
    target = create_target(client, fake_llm, with_resume=True, jd="We need React and TypeScript " * 3)
    with SessionLocal() as db:
        rows = {e.requirement_key: e for e in db.query(Evidence).all()}
    assert {k: e.score for k, e in rows.items()} == {"react": 85, "typescript": 15, "rest-api-design": 55}
    assert all(e.source == "baseline" and e.target_role_id == target["id"] for e in rows.values())


def test_new_target_becomes_the_only_active_one(client, user, fake_llm):
    first = create_target(client, fake_llm, title="Frontend Engineer")
    second = create_target(client, fake_llm, title="Fullstack Engineer")
    targets = client.get("/api/readiness/targets").json()["targets"]
    assert [(t["id"], t["isActive"]) for t in targets] == [(second["id"], True), (first["id"], False)]
    r = client.post(f"/api/readiness/targets/{first['id']}/activate")
    assert r.status_code == 200 and r.json()["isActive"]
    with SessionLocal() as db:
        assert readiness.active_target(db, user["id"]).id == first["id"]


def test_targets_are_private(client, user, fake_llm):
    target = create_target(client, fake_llm)
    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    assert client.get("/api/readiness/targets").json()["targets"] == []
    assert client.post(f"/api/readiness/targets/{target['id']}/activate").status_code == 404


def test_match_requirement_and_record_evidence(client, user, fake_llm):
    create_target(client, fake_llm)
    with SessionLocal() as db:
        target = db.query(TargetRole).one()
        assert readiness.match_requirement(target, "React.js") == "react"
        assert readiness.match_requirement(target, "TS") == "typescript"
        assert readiness.match_requirement(target, "Go") is None
        e = readiness.record_evidence(db, user["id"], "assessment", "ReactJS", 140)
        assert (e.requirement_key, e.score, e.target_role_id) == ("react", 100, target.id)
        e = readiness.record_evidence(db, user["id"], "assessment", "Go", 50)
        assert e.requirement_key is None


def test_invalid_resume_not_charged(client, user, fake_llm):
    files = {"resume": ("cv.exe", b"MZ" * 100, "application/octet-stream")}
    r = client.post("/api/readiness/targets", data={"title": "Engineer"}, files=files)
    assert r.status_code == 400
    assert client.get("/api/auth/me").json()["credits"] == 10
    assert fake_llm.calls == []
