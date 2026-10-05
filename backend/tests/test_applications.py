from datetime import date

from app.llm import LLMError
from app.models import Application
from app.services import applications as svc
from tests.conftest import register
from tests.test_readiness import create_target, requirement_map

JD = ("We are hiring a Frontend Engineer to build React and TypeScript dashboards, design REST APIs "
      "with the backend team, review code and mentor juniors. You will own performance and testing. ") * 3

KIT = {
    "role_summary": "Builds dashboards. Success is fast, tested UI.",
    "focus_skills": [{"skill": "React", "priority": "high", "why": "Core of the role"},
                     {"skill": "TypeScript", "priority": "high", "why": "Listed first"},
                     {"skill": "GraphQL", "priority": "low", "why": "Nice to have"}],
    "likely_questions": [{"question": "How do you profile a slow render?", "type": "technical",
                          "tip": "Mention the profiler"}],
    "questions_to_ask": ["How is success measured in 90 days?"],
    "research_checklist": ["Their main product"],
}


def add(client, **kw):
    body = {"company": "Acme", "title": "Frontend Engineer", "job_description": JD, **kw}
    r = client.post("/api/applications", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def credits(client):
    return client.get("/api/auth/me").json()["credits"]


def test_create_list_and_checklist_for_saved(client, user):
    app = add(client, job_url="https://jobs.example.com/1", next_date="2099-01-05", next_label="Apply by")
    assert app["status"] == "saved" and app["history"][0]["status"] == "saved"
    keys = [c["key"] for c in app["checklist"]]
    assert keys == ["make_target", "tailor", "cover_letter"]
    assert app["checklist"][1]["href"] == f"/resume-tailor?application={app['id']}"
    data = client.get("/api/applications").json()
    assert len(data["applications"]) == 1
    assert data["stats"]["upcoming"][0]["label"] == "Apply by"
    assert credits(client) == 10  # tracking is free


def test_bad_url_and_date_rejected(client, user):
    r = client.post("/api/applications",
                    json={"company": "A", "title": "B", "job_url": "javascript:alert(1)"})
    assert r.status_code == 400
    r = client.post("/api/applications", json={"company": "A", "title": "B", "next_date": "next week"})
    assert r.status_code == 422


def test_status_history_and_checklist_grow_with_stage(client, user):
    app = add(client)
    url = f"/api/applications/{app['id']}"
    r = client.patch(url, json={"status": "interview", "checklist": {"tailor": True}})
    body = r.json()
    assert [h["status"] for h in body["history"]] == ["saved", "interview"]
    stages = {c["stage"] for c in body["checklist"]}
    assert stages == {"saved", "applied", "assessment", "interview"}
    assert next(c for c in body["checklist"] if c["key"] == "tailor")["done"] is True
    # Same status again does not add a history entry; closing keeps the stages reached.
    client.patch(f"/api/applications/{app['id']}", json={"status": "interview"})
    body = client.patch(f"/api/applications/{app['id']}", json={"status": "rejected"}).json()
    assert len(body["history"]) == 3
    assert any(c["key"] == "mock" for c in body["checklist"])
    assert client.patch(url, json={"checklist": {"hack": True}}).status_code == 400


def test_clear_next_date(client, user):
    app = add(client, next_date="2099-01-01")
    body = client.patch(f"/api/applications/{app['id']}", json={"clear_next_date": True}).json()
    assert body["nextDate"] is None


def test_applications_are_private(client, user):
    app = add(client)
    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    assert client.get(f"/api/applications/{app['id']}").status_code == 404
    assert client.patch(f"/api/applications/{app['id']}", json={"notes": "x"}).status_code == 404
    assert client.delete(f"/api/applications/{app['id']}").status_code == 404
    assert client.get("/api/applications").json()["applications"] == []


def test_delete(client, user):
    app = add(client)
    assert client.delete(f"/api/applications/{app['id']}").status_code == 204
    assert client.get(f"/api/applications/{app['id']}").status_code == 404


def test_stats():
    def mk(status, history=()):
        return Application(company="c", title="t", status=status,
                           status_history=[{"status": s, "at": ""} for s in (*history, status)],
                           next_date=None)
    apps = [mk("saved"), mk("applied", ["saved"]), mk("interview", ["applied"]),
            mk("rejected", ["applied", "assessment"]), mk("offer", ["applied", "interview"])]
    s = svc.stats(apps, date(2026, 1, 1))
    assert s["applied"] == 4
    assert s["responseRate"] == 75  # 3 of 4 reached an assessment or later
    assert s["interviews"] == 2 and s["offers"] == 1
    assert s["counts"]["rejected"] == 1


def test_upcoming_skips_past_and_closed():
    apps = [Application(id=1, company="a", title="t", status="applied", status_history=[],
                        next_date="2025-12-31", next_label="old"),
            Application(id=2, company="b", title="t", status="rejected", status_history=[],
                        next_date="2026-02-01", next_label="closed"),
            Application(id=3, company="c", title="t", status="interview", status_history=[],
                        next_date="2026-01-03", next_label="Onsite")]
    assert [u["id"] for u in svc.stats(apps, date(2026, 1, 1))["upcoming"]] == [3]


def test_prep_kit_needs_job_description(client, user, fake_llm):
    app = add(client, job_description="short")
    r = client.post(f"/api/applications/{app['id']}/prep-kit")
    assert r.status_code == 400
    assert credits(client) == 10 and fake_llm.calls == []


def test_prep_kit_uses_gaps_and_attaches_scores(client, user, fake_llm):
    create_target(client, fake_llm, with_resume=True)  # React met, TypeScript missing
    app = add(client, status="interview")
    before = credits(client)
    fake_llm.push(KIT)
    r = client.post(f"/api/applications/{app['id']}/prep-kit")
    assert r.status_code == 200, r.text
    assert credits(client) == before - 2
    prompt = fake_llm.calls[-1][1]["prompt"]
    assert "<job_description>" in prompt and "TypeScript" in prompt.split("weakest")[1]
    prep = r.json()["prep"]
    scores = {s["skill"]: s["yourScore"] for s in prep["focusSkills"]}
    assert scores["React"] == 85 and scores["TypeScript"] == 15 and scores["GraphQL"] is None
    assert next(c for c in r.json()["checklist"] if c["key"] == "prep_kit")["done"] is True
    assert client.get(f"/api/applications/{app['id']}").json()["prep"]["roleSummary"]


def test_prep_kit_failure_refunds(client, user, fake_llm):
    app = add(client)
    fake_llm.push(LLMError())
    r = client.post(f"/api/applications/{app['id']}/prep-kit")
    assert r.status_code == 503
    assert credits(client) == 10


def test_make_target_from_application(client, user, fake_llm):
    app = add(client)
    fake_llm.push(requirement_map())
    r = client.post(f"/api/applications/{app['id']}/make-target")
    assert r.status_code == 200, r.text
    assert r.json()["target"]["title"] == "Frontend Engineer"
    assert next(c for c in r.json()["application"]["checklist"] if c["key"] == "make_target")["done"]
    assert client.get("/api/readiness").json()["target"]["title"] == "Frontend Engineer"
    assert credits(client) == 8
