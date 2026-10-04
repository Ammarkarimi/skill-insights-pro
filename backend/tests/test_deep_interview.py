import io
import json

from app.db import SessionLocal
from app.llm import LLMError
from app.models import DeepInterview, Evidence
from tests.conftest import register
from tests.test_readiness import create_target

RESUME = ("Jane Doe\nSenior Engineer at Acme\n- Cut API latency by 40% by redesigning caching.\n"
          "- Led migration of 12 services to Kubernetes.\nSECRET-LINE-NOT-A-CLAIM\n") * 2


def files():
    return {"resume": ("cv.txt", io.BytesIO(RESUME.encode()), "text/plain")}


def plan(n=2):
    claims = [("React", "Cut API latency by 40%"), ("TypeScript", "Led migration of 12 services")]
    return {"topics": [{"requirement": r, "claim": c, "opening_question": f"Tell me about: {c}?",
                        "strong_answer": "specifics"} for r, c in claims[:n]]}


def report(n=2):
    topic = {"score": 8, "claim_verdict": "supported", "verdict_reason": "detailed",
             "strengths": ["specific"], "improvements": [], "resume_fix": "", "model_answer": "m"}
    return {"overall_score": 140, "readiness": "almost_ready", "summary": "s", "communication": "c",
            "top_strengths": [], "focus_next": [], "topics": [topic] * n}


def start(client, fake_llm, **data):
    fake_llm.push(plan())
    r = client.post("/api/deep-interview/start", files=files(), data=data)
    assert r.status_code == 201, r.text
    return r.json()


def answer(client, iid, text="My answer", metrics=None):
    r = client.post(f"/api/deep-interview/{iid}/answer", json={"answer": text, "metrics": metrics})
    assert r.status_code == 200, r.text
    return r.json()


def test_start_needs_a_role_and_is_not_charged_otherwise(client, user, fake_llm):
    r = client.post("/api/deep-interview/start", files=files())
    assert r.status_code == 400
    assert client.get("/api/auth/me").json()["credits"] == 10
    assert fake_llm.calls == []


def test_start_returns_first_question_without_rubric(client, user, fake_llm):
    body = start(client, fake_llm, role_title="Backend Engineer")
    assert body["question"]["text"] == "Tell me about: Cut API latency by 40%?"
    assert body["topicCount"] == 2 and body["status"] == "active"
    assert "strong_answer" not in json.dumps(body)
    assert client.get("/api/auth/me").json()["credits"] == 7
    with SessionLocal() as db:  # only quoted claims are stored, never the resume itself
        stored = json.dumps(db.query(DeepInterview).one().plan)
    assert "SECRET-LINE-NOT-A-CLAIM" not in stored


def test_follow_ups_are_capped_then_topics_advance(client, user, fake_llm):
    iid = start(client, fake_llm, role_title="Backend Engineer")["id"]
    fake_llm.push({"action": "follow_up", "question": "How did you measure it?"})
    assert answer(client, iid)["question"]["kind"] == "follow_up"
    fake_llm.push({"action": "follow_up", "question": "What was your part?"})
    assert answer(client, iid)["question"]["text"] == "What was your part?"
    calls = len(fake_llm.calls)
    body = answer(client, iid)  # cap reached: no LLM call, next topic's opening question
    assert len(fake_llm.calls) == calls
    assert (body["question"]["kind"], body["currentTopic"]) == ("opening", 1)
    fake_llm.push({"action": "next_topic", "question": ""})
    body = answer(client, iid)
    assert body["status"] == "ready" and body["question"] is None
    assert client.post(f"/api/deep-interview/{iid}/answer", json={"answer": "late"}).status_code == 409
    assert client.get("/api/auth/me").json()["credits"] == 7  # turns are free


def test_turn_failure_degrades_to_next_topic(client, user, fake_llm):
    iid = start(client, fake_llm, role_title="Backend Engineer")["id"]
    fake_llm.push(LLMError())
    body = answer(client, iid)
    assert body["currentTopic"] == 1 and body["question"]["kind"] == "opening"


def test_finish_flow(client, user, fake_llm):
    create_target(client, fake_llm)
    iid = start(client, fake_llm)["id"]
    voice = {"mode": "voice", "words": 150, "durationSec": 60, "wpm": 150, "fillers": 3, "longPauses": 1}
    fake_llm.push({"action": "next_topic", "question": ""})
    answer(client, iid, metrics=voice)
    fake_llm.push(report())
    r = client.post(f"/api/deep-interview/{iid}/finish")
    assert r.status_code == 200, r.text
    body = r.json()
    rep = body["report"]
    assert body["status"] == "completed" and rep["overall"]["overall_score"] == 100
    assert rep["delivery"] == {"voiceAnswers": 1, "wordsPerMinute": 150, "fillersPerMinute": 3.0,
                               "longPauses": 1}
    assert "Delivery stats" in fake_llm.calls[-1][1]["prompt"]
    first, second = rep["topics"]
    assert (first["answered"], first["score"], first["claimVerdict"]) == (True, 8, "supported")
    assert (second["answered"], second["score"]) == (False, 0)
    assert client.get("/api/auth/me").json()["credits"] == 10 - 2 - 3 - 3
    with SessionLocal() as db:
        ev = [(e.source, e.requirement_key, e.score) for e in db.query(Evidence).all()]
    assert ev == [("deep_interview", "react", 80)]
    # Finishing again is idempotent and free.
    assert client.post(f"/api/deep-interview/{iid}/finish").json()["status"] == "completed"
    assert client.get("/api/auth/me").json()["credits"] == 2
    hist = client.get("/api/interview/history").json()["interviews"]
    assert hist[0]["kind"] == "deep" and hist[0]["overallScore"] == 100


def test_finish_requires_an_answer_and_interviews_are_private(client, user, fake_llm):
    iid = start(client, fake_llm, role_title="Backend Engineer")["id"]
    assert client.post(f"/api/deep-interview/{iid}/finish").status_code == 400
    assert client.get("/api/auth/me").json()["credits"] == 7
    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    assert client.get(f"/api/deep-interview/{iid}").status_code == 404
    assert client.post(f"/api/deep-interview/{iid}/answer", json={"answer": "x"}).status_code == 404


def test_schemas_are_strict_compatible():
    from openai.lib._parsing._responses import type_to_text_format_param

    from app.services.deep_interview import DeepReport, InterviewPlan, TurnDecision

    for schema in (InterviewPlan, TurnDecision, DeepReport):
        assert type_to_text_format_param(schema)["strict"] is True
