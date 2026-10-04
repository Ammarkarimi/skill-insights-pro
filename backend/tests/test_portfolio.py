from datetime import datetime, timedelta, timezone

from app.db import SessionLocal
from app.models import GithubAccount, ProjectReview, ProofAssessment
from app.routers.portfolio import badge_svg, share_page
from tests.conftest import register

T0 = datetime(2026, 9, 1, tzinfo=timezone.utc)


def add_proof(user_id, skill="React", level="Advanced", proficiency=88, days=0):
    with SessionLocal() as db:
        p = ProofAssessment(user_id=user_id, skill=skill, skill_key=skill.lower(), pool=[], served=[],
                            status="completed", level=level, proficiency=proficiency,
                            created_at=T0 + timedelta(days=days), completed_at=T0 + timedelta(days=days))
        db.add(p)
        db.commit()
        return p.id


def add_review(user_id, repo="janedoe/shop"):
    review = {"project_type": "React SPA", "summary": "Solid.", "overall_score": 78,
              "rubric": [{"dimension": "testing", "score": 6, "evidence": "e", "improvement": "i"}],
              "skills": [{"skill": "React", "level": "solid", "score": 80, "evidence": "e"}],
              "highlights": ["CI"], "improvements": ["x"], "talking_points": ["y"]}
    with SessionLocal() as db:
        r = ProjectReview(user_id=user_id, repo_full_name=repo, repo_url=f"https://github.com/{repo}",
                          commit_sha="abcdef1234", ownership={"status": "owner", "detail": "d"},
                          repo_meta={"languages": {"TypeScript": 1}}, review=review, overall_score=78)
        db.add(r)
        db.commit()
        return r.id


def save(client, **over):
    body = {"slug": "ada-lovelace", "displayName": "Ada Lovelace", "headline": "Backend engineer",
            "bio": "I build things.", "isPublished": True, "allowIndexing": False,
            "proofIds": [], "reviewIds": [], "showGithub": True, "showReadiness": False, **over}
    return client.put("/api/portfolio", json=body)


def test_defaults_and_slug_rules(client, user):
    body = client.get("/api/portfolio").json()
    assert body["settings"]["slug"] == "ada" and body["settings"]["isPublished"] is False
    for bad in ("ab", "Has Caps!", "-dash", "admin"):
        assert save(client, slug=bad).status_code in (400, 422)
    assert save(client).status_code == 200
    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    assert save(client).status_code == 409  # taken by Ada


def test_public_page_is_sanitized_and_noindex(client, user):
    old = add_proof(user["id"], proficiency=60, level="Intermediate")
    new = add_proof(user["id"], days=3)
    hidden = add_proof(user["id"], skill="Go", level="Beginner", proficiency=40)
    review = add_review(user["id"])
    with SessionLocal() as db:
        db.add(GithubAccount(user_id=user["id"], github_id=7, login="janedoe"))
        db.commit()
    assert client.get("/api/public/portfolio/ada-lovelace").status_code == 404  # not created yet
    save(client, proofIds=[old, new, 99999], reviewIds=[review], isPublished=False)
    assert client.get("/api/public/portfolio/ada-lovelace").status_code == 404  # unpublished
    settings = save(client, proofIds=[old, new, 99999], reviewIds=[review]).json()
    assert settings["proofIds"] == sorted([old, new])  # foreign/unknown ids dropped
    assert hidden not in settings["proofIds"]

    client.post("/api/auth/logout")  # the public page needs no login
    r = client.get("/api/public/portfolio/ada-lovelace")
    assert r.status_code == 200 and r.headers["x-robots-tag"] == "noindex, nofollow"
    body = r.json()
    assert "ada@example.com" not in r.text and "email" not in body
    assert body["proofs"] == [{"skill": "React", "level": "Advanced", "proficiency": 88,
                               "completedAt": body["proofs"][0]["completedAt"], "attempts": 2}]
    proj = body["projects"][0]
    assert proj["ownership"]["status"] == "owner" and proj["commitSha"] == "abcdef1"
    assert "improvements" not in proj and "talking_points" not in proj  # private coaching stays private
    assert body["github"]["login"] == "janedoe"


def test_indexing_opt_in(client, user):
    save(client, allowIndexing=True)
    r = client.get("/api/public/portfolio/ada-lovelace")
    assert "x-robots-tag" not in r.headers


def test_badge(client, user):
    pid = add_proof(user["id"])
    save(client, proofIds=[pid])
    r = client.get("/api/public/portfolio/ada-lovelace/badge.svg", params={"skill": "react"})
    assert r.headers["content-type"].startswith("image/svg+xml")
    assert "Advanced ✓" in r.text and "React" in r.text
    r = client.get("/api/public/portfolio/ada-lovelace/badge.svg", params={"skill": "<script>x</script>"})
    assert "<script>" not in r.text and "not proven" in r.text
    assert badge_svg("a&b", "c", "#000").count("&amp;") == 3  # aria-label, title and text escaped


def test_share_page_injects_meta(client, user):
    index = ('<html><head><meta charset="UTF-8" /><title>Skill Sphere</title>'
             '<meta\n  name="description"\n  content="old"\n/>'
             '<meta property="og:title" content="old" /></head><body></body></html>')
    save(client, displayName='Ada "<b>"', headline="Backend engineer")
    with SessionLocal() as db:
        page, headers = share_page(db, "p/ada-lovelace", index)
        assert page.count("<title>") == 1 and "Ada &quot;&lt;b&gt;&quot;: verified skills" in page
        assert 'content="old"' not in page and 'property="og:url"' in page
        assert 'name="robots" content="noindex, nofollow"' in page and headers["X-Robots-Tag"]
        assert share_page(db, "p/unknown-slug", index) is None
        assert share_page(db, "home", index) is None
