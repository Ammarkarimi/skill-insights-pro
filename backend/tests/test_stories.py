import io
import random

from app.db import SessionLocal
from app.llm import LLMError
from app.models import Evidence
from app.services import stories as svc
from tests.conftest import register
from tests.test_readiness import req

RESUME = ("Jane Doe\nSoftware Engineer at Acme (2021-2024). Rebuilt the checkout service in Python, "
          "cutting p95 latency by 40%. Mentored 3 junior engineers. Led the migration to Postgres.\n") * 2


def draft(title="Cut checkout latency", action="I profiled the service and rewrote the slow queries.",
          result="Latency fell by [X%] and checkout errors dropped.", themes=("ownership", "data")):
    return {"title": title, "situation": "Checkout at Acme was slow during sales.",
            "task": "I owned making checkout fast before the holiday sale.", "action": action,
            "result": result, "themes": list(themes), "coaching_questions": ["How much did latency drop?"]}


def credits(client):
    return client.get("/api/auth/me").json()["credits"]


def upload(client):
    files = {"resume": ("cv.txt", io.BytesIO(RESUME.encode()), "text/plain")}
    return client.post("/api/stories/draft", files=files)


def test_draft_from_resume_keeps_placeholders_and_flags_new_figures(client, user, fake_llm):
    second = draft(title="Postgres migration", result="Saved 75% of hosting costs.",
                   themes=("leadership", "leadership", "teamwork"))
    fake_llm.push({"stories": [draft(), second]})
    r = upload(client)
    assert r.status_code == 201, r.text
    stories = r.json()["stories"]
    assert credits(client) == 8
    first, second = stories
    assert first["placeholders"] == 1 and first["coaching"]["questions"] and not first["coaching"]["warnings"]
    assert second["themes"] == ["leadership", "teamwork"]  # de-duplicated
    assert "75%" in second["coaching"]["warnings"][0]  # a figure the resume never stated
    assert "<resume>" in fake_llm.calls[-1][1]["prompt"]


def test_draft_rejects_bad_upload_without_charge(client, user, fake_llm):
    files = {"resume": ("cv.exe", io.BytesIO(b"MZ..."), "application/x-msdownload")}
    r = client.post("/api/stories/draft", files=files)
    assert r.status_code in (400, 415, 422)
    assert credits(client) == 10 and fake_llm.calls == []


def test_crud_coverage_and_privacy(client, user):
    body = {"title": "Conflict with PM", "situation": "We disagreed on scope.", "task": "Ship on time.",
            "action": "I proposed a phased plan.", "result": "We shipped phase one in [N] weeks.",
            "themes": ["conflict", "influence"]}
    s = client.post("/api/stories", json=body).json()
    assert s["origin"] == "manual" and s["spokenSeconds"] > 0
    data = client.get("/api/stories").json()
    cover = {c["theme"]: c["count"] for c in data["coverage"]}
    assert cover["conflict"] == 1 and cover["failure"] == 0 and len(data["coverage"]) == 12
    upd = client.patch(f"/api/stories/{s['id']}",
                       json={"themes": ["conflict"], "result": "Shipped in 3 weeks."})
    assert upd.json()["themes"] == ["conflict"] and upd.json()["result"] == "Shipped in 3 weeks."
    assert client.post("/api/stories", json={**body, "themes": ["nonsense"]}).status_code == 422
    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    assert client.patch(f"/api/stories/{s['id']}", json={"title": "x"}).status_code == 404
    assert client.delete(f"/api/stories/{s['id']}").status_code == 404
    assert client.get("/api/stories").json()["stories"] == []


CRITIQUE = {
    **{k: {"score": 7, "feedback": f"{k} ok"} for k in ("situation", "task", "action")},
    "result": {"score": 14, "feedback": "Needs a number"},
    "overall_score": 72, "ownership": "Clear 'I' statements.", "quantified": False,
    "strengths": ["Specific action"], "improvements": ["Quantify the result"],
    "rewrite": {"situation": "Checkout was slow.", "task": "I owned the fix.",
                "action": "I profiled and rewrote queries.", "result": "Latency fell 90%."},
    "follow_up_questions": ["How did you measure it?"], "best_themes": ["data", "ownership"],
}


def test_critique_scores_flags_invented_figures_and_goes_stale(client, user, fake_llm):
    fake_llm.push({"stories": [draft()]})
    s = upload(client).json()["stories"][0]
    fake_llm.push(CRITIQUE)
    r = client.post(f"/api/stories/{s['id']}/critique")
    assert r.status_code == 200, r.text
    c = r.json()["critique"]
    assert r.json()["score"] == 72 and c["parts"]["result"]["score"] == 10  # clamped
    assert "90%" in c["rewriteWarnings"][0]
    assert credits(client) == 7
    stale = client.patch(f"/api/stories/{s['id']}", json={"action": "I added an index."}).json()
    assert stale["critique"]["stale"] is True


def test_critique_needs_enough_text(client, user, fake_llm):
    s = client.post("/api/stories", json={"title": "Thin", "situation": "x"}).json()
    assert client.post(f"/api/stories/{s['id']}/critique").status_code == 400
    assert credits(client) == 10


def test_pick_drill_targets_gaps_and_suggests_stories():
    stories = [{"id": 1, "title": "a", "themes": ["leadership", "teamwork"], "score": 80},
               {"id": 2, "title": "b", "themes": ["leadership"], "score": 40}]
    picked = svc.pick_drill(stories, random.Random(2))
    assert len(picked) == 5 and len({q["themes"][0] for q in picked}) == 5
    assert not any(q["themes"][0] in ("leadership", "teamwork") for q in picked)  # gaps first
    lead_q = svc.QUESTIONS_BY_ID[1]
    assert svc.suggest_story(lead_q, stories) == 1  # same overlap: higher score wins
    assert svc.suggest_story(svc.QUESTIONS_BY_ID[50], stories) is None


EVAL = {"answers": [{"score": 8, "structure": "Clear STAR.", "relevance": "On point.", "impact": "Owned.",
                     "better_answer_outline": "S/T/A/R"},
                    {"score": 9, "structure": "n/a", "relevance": "n/a", "impact": "n/a",
                     "better_answer_outline": ""}],
        "overall": {"score": 70, "summary": "Good.", "focus_next": ["Quantify results"]}}


def test_drill_evaluates_records_evidence_and_zeroes_blank_answers(client, user, fake_llm):
    fake_llm.push({"summary": "PM", "requirements": [req("Leadership"), req("Communication")]})
    client.post("/api/readiness/targets", data={"title": "Product Manager"})
    s = client.post("/api/stories", json={"title": "Led launch", "themes": ["leadership"]}).json()
    assert client.get("/api/stories/drill/questions").json()["questions"]
    before = credits(client)
    fake_llm.push(EVAL)
    r = client.post("/api/stories/drill", json={"answers": [
        {"question_id": 1, "story_id": s["id"], "answer": "I led the launch of..."},
        {"question_id": 16, "answer": "   "}]})
    assert r.status_code == 201, r.text
    body = r.json()
    assert [a["score"] for a in body["answers"]] == [8, 0]
    assert body["answers"][0]["storyTitle"] == "Led launch"
    assert credits(client) == before - 2
    with SessionLocal() as db:
        ev = sorted((e.skill, e.score) for e in db.query(Evidence).filter(Evidence.source == "story_drill"))
    assert ev == [("Communication", 70), ("Leadership", 80)]
    assert client.get("/api/stories/drills").json()["drills"][0]["score"] == 70
    assert client.get(f"/api/stories/drills/{body['id']}").json()["overall"]["score"] == 70


def test_drill_validation(client, user, fake_llm):
    def post(**answer):
        return client.post("/api/stories/drill", json={"answers": [answer]}).status_code
    assert post(question_id=1, answer=" ") == 400
    assert post(question_id=999, answer="x") == 400
    assert post(question_id=1, story_id=12345, answer="x") == 404
    fake_llm.push(LLMError())
    assert post(question_id=1, answer="x") == 503
    assert credits(client) == 10
