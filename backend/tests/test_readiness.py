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


# ---------------------------------------------------------------- scoring
from datetime import datetime, timedelta, timezone  # noqa: E402

NOW = datetime(2026, 10, 1, 12, tzinfo=timezone.utc)


def _target():
    return TargetRole(id=1, user_id=1, title="Frontend Engineer", requirements=[
        {"key": "react", "name": "React", "kind": "skill", "weight": 3, "must_have": True, "aliases": []},
        {"key": "typescript", "name": "TypeScript", "kind": "skill", "weight": 2, "must_have": True,
         "aliases": []},
        {"key": "code-review", "name": "Code review", "kind": "practice", "weight": 1,
         "must_have": False, "aliases": []},
    ])


def _ev(key, source, score, days_ago=0):
    return Evidence(user_id=1, target_role_id=1, requirement_key=key, skill=key, source=source,
                    score=score, payload={}, created_at=NOW - timedelta(days=days_ago))


def test_unmeasured_requirements_count_as_zero():
    out = readiness.compute_readiness(_target(), [_ev("react", "assessment", 80)], now=NOW)
    # (3*80 + 2*0 + 1*0) / 6 = 40
    assert (out["score"], out["coverage"]) == (40, 33)
    react = next(r for r in out["requirements"] if r["key"] == "react")
    assert react["score"] == 80 and react["sources"] == {"assessment": 80}


def test_source_weights_and_recency():
    ev = [_ev("react", "baseline", 20), _ev("react", "assessment", 80)]
    out = readiness.compute_readiness(_target(), ev, now=NOW)
    react = next(r for r in out["requirements"] if r["key"] == "react")
    assert react["score"] == round((0.4 * 20 + 1.0 * 80) / 1.4)  # 63
    # An old assessment counts less than a fresh one.
    ev = [_ev("react", "assessment", 20, days_ago=180), _ev("react", "assessment", 80)]
    react = next(r for r in readiness.compute_readiness(_target(), ev, now=NOW)["requirements"]
                 if r["key"] == "react")
    assert react["score"] == round((0.25 * 20 + 1.0 * 80) / 1.25)  # 68


def test_trend_has_one_point_per_evidence_day():
    ev = [_ev("react", "assessment", 60, days_ago=10), _ev("typescript", "assessment", 90, days_ago=2)]
    trend = readiness.compute_readiness(_target(), ev, now=NOW)["trend"]
    assert [t["date"] for t in trend] == ["2026-09-21", "2026-09-29", "2026-10-01"]
    assert trend[0]["score"] < trend[1]["score"]
    assert trend[-1]["score"] == readiness.compute_readiness(_target(), ev, now=NOW)["score"]


def test_requirements_ordered_must_have_first_then_weight():
    out = readiness.compute_readiness(_target(), [], now=NOW)
    assert [r["key"] for r in out["requirements"]] == ["react", "typescript", "code-review"]
    assert out["score"] == 0 and out["coverage"] == 0


def test_next_actions_rules():
    target = _target()
    out = readiness.compute_readiness(target, [], now=NOW)
    actions = readiness.next_actions(target, out, [], now=NOW)
    assert [a["type"] for a in actions] == ["assessment", "resume", "deep_interview"]
    assert actions[0]["href"] == "/skill-assessment?skills=React%2CTypeScript"

    ev = [_ev("react", "assessment", 40), _ev("typescript", "assessment", 90),
          _ev("react", "resume", 50, days_ago=3), _ev("react", "deep_interview", 50, days_ago=1)]
    out = readiness.compute_readiness(target, ev, now=NOW)
    actions = readiness.next_actions(target, out, ev, now=NOW)
    assert [a["type"] for a in actions] == ["prove", "improve"]
    assert actions[0]["href"] == "/portfolio?prove=React"  # highest-weight unproven must-have
    assert "React" in actions[1]["title"]

    proven = ev + [_ev("react", "proof_assessment", 70), _ev("typescript", "project", 85)]
    out = readiness.compute_readiness(target, proven, now=NOW)
    # Both proven: no more "prove" action (React is still weak, so "improve" stays).
    assert [a["type"] for a in readiness.next_actions(target, out, proven, now=NOW)] == ["improve"]


def test_readiness_endpoint(client, user, fake_llm):
    assert client.get("/api/readiness").json() == {"target": None}
    target = create_target(client, fake_llm, with_resume=True)
    body = client.get("/api/readiness").json()
    assert body["target"]["id"] == target["id"]
    # baseline: react 85 (w3), typescript 15 (w3), rest 55 (w2), code review unmeasured (w1)
    assert body["score"] == round((3 * 85 + 3 * 15 + 2 * 55) / 9)
    assert body["coverage"] == 75
    assert body["actions"][0]["type"] == "resume"
    assert len(body["trend"]) == 1


# ---------------------------------------------------------------- evidence hooks
def _evidence(source=None):
    with SessionLocal() as db:
        q = db.query(Evidence)
        if source:
            q = q.filter(Evidence.source == source)
        return [(e.requirement_key, e.skill, e.score) for e in q.order_by(Evidence.id).all()]


def test_assessment_submit_records_difficulty_scaled_evidence(client, user, fake_llm):
    from tests.test_features import mcq

    create_target(client, fake_llm)
    fake_llm.push({"questions": [{**mcq("B"), "skill": "React"} for _ in range(5)]})
    body = client.post("/api/assessment/questions",
                       json={"skills": ["React"], "difficulty": "beginner", "count": 5}).json()
    answers = {q["id"]: next(k for k, v in q["options"].items() if v == "opt B") for q in body["questions"]}
    client.post(f"/api/assessment/{body['sessionId']}/submit", json={"answers": answers})
    client.post(f"/api/assessment/{body['sessionId']}/submit", json={"answers": answers})  # no duplicate
    assert _evidence("assessment") == [("react", "React", 70)]  # 100% at beginner level -> 70


def test_resume_analysis_records_evidence_only_for_target(client, user, fake_llm):
    from tests.test_features import analysis_payload

    create_target(client, fake_llm, jd="Frontend role requiring React and TypeScript experience.")
    files = lambda: {"resume": ("cv.txt", io.BytesIO(RESUME.encode()), "text/plain")}  # noqa: E731
    fake_llm.push(analysis_payload([]))
    client.post("/api/resume/analyze", files=files())
    assert _evidence("resume") == []

    fake_llm.push(analysis_payload([]))
    r = client.post("/api/resume/analyze", files=files(), data={"use_target": "true"})
    assert r.json()["targetRole"]["title"] == "Frontend Engineer"
    prompt = fake_llm.calls[-1][1]["prompt"]
    assert "Target role: Frontend Engineer" in prompt and "React and TypeScript" in prompt
    # Skill requirements only: React is in the resume, TypeScript and REST API design are not.
    assert _evidence("resume") == [("react", "React", 75), ("typescript", "TypeScript", 20),
                                   ("rest-api-design", "REST API design", 20)]


def test_interview_records_evidence(client, user, fake_llm):
    fake_llm.push({**requirement_map(), "requirements": [*requirement_map()["requirements"],
                   req("Communication", kind="practice", must=False, weight=1)]})
    client.post("/api/readiness/targets", data={"title": "Frontend Engineer"})
    fb = {"score": 7, "verdict": "good", "strengths": [], "improvements": [], "model_answer": "m"}
    for topic in ("React", "Frontend Development"):
        fake_llm.push({"answers": [fb], "overall": {"overall_score": 66, "readiness": "almost_ready",
                                                    "summary": "s", "communication": "c",
                                                    "top_strengths": [], "focus_next": []}})
        r = client.post("/api/interview/evaluate", json={
            "topic": topic, "difficulty": "beginner", "answers": [{"question": "Q?", "answer": "A"}]})
        assert r.status_code == 200, r.text
    assert _evidence("interview") == [("react", "React", 66),
                                      ("communication", "Frontend Development", 66)]


def test_hooks_without_target_still_work(client, user, fake_llm):
    from tests.test_features import mcq

    fake_llm.push({"questions": [mcq("B") for _ in range(5)]})
    body = client.post("/api/assessment/questions",
                       json={"skills": ["Python"], "difficulty": "advanced", "count": 5}).json()
    r = client.post(f"/api/assessment/{body['sessionId']}/submit", json={"answers": {}})
    assert r.status_code == 200
    assert _evidence("assessment") == [(None, "Python", 0)]
