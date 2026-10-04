import json
from datetime import datetime, timedelta, timezone

import pytest

from app.db import SessionLocal
from app.models import Evidence, ProofAssessment
from app.services import proof as svc
from app.services.readiness import SOURCE_WEIGHTS
from tests.conftest import register
from tests.test_readiness import create_target


def mcq(level, i):
    opts = [{"key": k, "text": f"{level}-{i}-opt {k}"} for k in "ABCD"]
    return {"question": f"{level} question {i}?", "code": "", "options": opts, "answer": "B",
            "explanation": "because", "topic": f"t{i}", "skill": "React", "level": level}


def pool(per_tier=5, skip_advanced=False):
    levels = ["beginner", "intermediate"] + ([] if skip_advanced else ["advanced"])
    return {"questions": [mcq(lv, i) for lv in levels for i in range(per_tier)]}


class Clock:
    def __init__(self):
        self.now = datetime(2026, 10, 1, 12, tzinfo=timezone.utc)

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += timedelta(seconds=seconds)


@pytest.fixture
def clock(monkeypatch):
    c = Clock()
    monkeypatch.setattr(svc, "now_utc", c)
    return c


def start(client, fake_llm, skill="React"):
    fake_llm.push(pool())
    r = client.post("/api/proof/start", json={"skill": skill})
    assert r.status_code == 201, r.text
    return r.json()


def correct_letter(q):
    return next(k for k, v in q["options"].items() if v.endswith("opt B"))


def wrong_letter(q):
    return next(k for k, v in q["options"].items() if not v.endswith("opt B"))


def tier_of(q):
    return q["question"].split()[0]


def answer(client, pid, letter, focus=0):
    r = client.post(f"/api/proof/{pid}/answer", json={"answer": letter, "focus_lost": focus})
    assert r.status_code == 200, r.text
    return r.json()


def test_pool_must_cover_every_tier(client, user, fake_llm, clock):
    fake_llm.push(pool(skip_advanced=True))
    r = client.post("/api/proof/start", json={"skill": "React"})
    assert r.status_code == 502
    assert client.get("/api/auth/me").json()["credits"] == 10  # refunded


def test_staircase_and_no_answer_leak(client, user, fake_llm, clock):
    body = start(client, fake_llm)
    assert client.get("/api/auth/me").json()["credits"] == 7
    q = body["question"]
    assert set(q) == {"id", "question", "code", "options", "secondsLeft"}
    assert "answer" not in json.dumps(body) and tier_of(q) == "intermediate"
    body = answer(client, body["id"], correct_letter(q))
    assert tier_of(body["question"]) == "advanced"          # correct -> harder
    body = answer(client, body["id"], wrong_letter(body["question"]))
    assert tier_of(body["question"]) == "intermediate"      # wrong -> easier
    body = answer(client, body["id"], wrong_letter(body["question"]))
    assert tier_of(body["question"]) == "beginner"
    assert body["questionNumber"] == 4 and body["status"] == "active"


def test_full_run_scores_level_and_records_evidence(client, user, fake_llm, clock):
    create_target(client, fake_llm)  # has a React requirement
    body = start(client, fake_llm)
    while body["status"] == "active":
        body = answer(client, body["id"], correct_letter(body["question"]), focus=1)
    res = body["result"]
    # 8 correct: first at intermediate, then advanced (pool has 5 advanced, then falls back).
    assert res["correct"] == 8 and res["level"] == "Advanced"
    assert res["perTier"]["advanced"] == {"answered": 5, "correct": 5}
    assert res["proficiency"] == round(100 * (0.85 * 3 + 1.0 * 5) / 8)
    assert res["focusLost"] == 1 and len(res["review"]) == 8 and "explanation" in res["review"][0]
    with SessionLocal() as db:
        ev = db.query(Evidence).filter(Evidence.source == "proof_assessment").one()
        assert (ev.requirement_key, ev.score, ev.payload["level"]) == ("react", res["proficiency"],
                                                                        "Advanced")
    assert SOURCE_WEIGHTS["proof_assessment"] > SOURCE_WEIGHTS["assessment"]
    assert client.post(f"/api/proof/{body['id']}/answer", json={"answer": "A"}).status_code == 409


def test_late_answers_count_as_wrong(client, user, fake_llm, clock):
    body = start(client, fake_llm)
    clock.advance(svc.SECONDS_PER_QUESTION + svc.GRACE_SECONDS + 1)
    body = answer(client, body["id"], correct_letter(body["question"]))
    assert tier_of(body["question"]) == "beginner"  # treated as wrong
    assert body["question"]["secondsLeft"] == svc.SECONDS_PER_QUESTION
    clock.advance(30)
    assert client.get(f"/api/proof/{body['id']}").json()["question"]["secondsLeft"] == 60


def test_cooldown_and_resume(client, user, fake_llm, clock):
    body = start(client, fake_llm)
    again = client.post("/api/proof/start", json={"skill": " react "})  # resumes, no charge
    assert again.json()["id"] == body["id"] and client.get("/api/auth/me").json()["credits"] == 7
    while body["status"] == "active":
        body = answer(client, body["id"], "")
    assert body["result"]["level"] == "Foundational" and body["result"]["proficiency"] == 0
    r = client.post("/api/proof/start", json={"skill": "React"})
    assert r.status_code == 429 and "24 hours" in r.json()["detail"]
    clock.advance(svc.COOLDOWN_HOURS * 3600 + 1)
    assert start(client, fake_llm)["id"] != body["id"]


def test_levels():
    s = lambda tier, ok: {"tier": tier, "correct": ok}  # noqa: E731
    assert svc.score([s(2, True), s(2, True), s(3, False)])["level"] == "Intermediate"
    assert svc.score([s(1, True), s(1, True), s(2, False)])["level"] == "Beginner"
    assert svc.score([s(2, False), s(1, True)])["level"] == "Foundational"


def test_proofs_are_private(client, user, fake_llm, clock):
    pid = start(client, fake_llm)["id"]
    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    assert client.get(f"/api/proof/{pid}").status_code == 404
    assert client.post(f"/api/proof/{pid}/answer", json={"answer": "A"}).status_code == 404
    with SessionLocal() as db:
        assert db.query(ProofAssessment).count() == 1


def test_schema_is_strict_compatible():
    from openai.lib._parsing._responses import type_to_text_format_param

    assert type_to_text_format_param(svc.ProofPool)["strict"] is True
