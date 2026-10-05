import copy
import random
from datetime import timedelta

import pytest

from app.data.coding_problems import PROBLEMS
from app.db import SessionLocal
from app.llm import LLMError
from app.models import Evidence
from app.services import coding
from tests.conftest import register
from tests.test_readiness import req


def normalise(value, mode):
    if mode == "unordered":
        return sorted(value)
    if mode == "groups":
        return sorted(sorted(g) for g in value)
    return value


@pytest.mark.parametrize("problem", PROBLEMS, ids=lambda p: p["slug"])
def test_reference_solution_passes_every_test(problem):
    namespace: dict = {}
    exec(problem["reference"], namespace)  # noqa: S102 - our own reference code
    fn = namespace[coding.function_names(problem)["python"]]
    for t in problem["tests"]:
        got = fn(*copy.deepcopy(t["args"]))
        assert normalise(got, problem["compare"]) == normalise(t["expected"], problem["compare"]), t


def test_bank_shape():
    slugs = [p["slug"] for p in PROBLEMS]
    assert len(slugs) == len(set(slugs)) >= 24
    for p in PROBLEMS:
        assert p["difficulty"] in ("easy", "medium", "hard")
        assert p["compare"] in ("exact", "unordered", "groups")
        assert any(not t["hidden"] for t in p["tests"]) and any(t["hidden"] for t in p["tests"])
        names = coding.function_names(p)
        assert names["python"].isidentifier() and names["javascript"].isidentifier()
    for level in ("easy", "medium", "hard"):
        assert sum(1 for p in PROBLEMS if p["difficulty"] == level) >= 6


def test_problem_detail_hides_reference(client, user):
    r = client.get("/api/coding/problems/two-sum")
    data = r.json()
    assert "reference" not in data and "reference" not in str(data)
    assert data["starterCode"]["python"].startswith("def two_sum(")
    assert data["starterCode"]["javascript"].startswith("function twoSum(")
    assert all(not e.get("hidden") for e in data["examples"])
    assert len(data["tests"]) == 6 and data["lastAttempt"] is None
    assert client.get("/api/coding/problems/nope").status_code == 404
    listing = client.get("/api/coding/problems").json()["problems"]
    assert len(listing) == len(PROBLEMS) and not any(p["attempted"] for p in listing)


def attempt(client, passed=6, total=6, slug="two-sum", **kw):
    body = {"slug": slug, "language": "python", "code": "def two_sum(): pass", "passed": passed,
            "total": total, **kw}
    return client.post("/api/coding/attempts", json=body)


def test_attempts_are_validated_and_listed(client, user):
    assert attempt(client, total=5).status_code == 400  # wrong test count for this problem
    assert attempt(client, passed=7).status_code == 400
    assert attempt(client, slug="nope").status_code == 404
    a = attempt(client, passed=4).json()
    attempt(client, passed=6)
    listing = client.get("/api/coding/problems").json()["problems"]
    assert next(p for p in listing if p["slug"] == "two-sum")["solved"] is True
    assert client.get("/api/coding/problems/two-sum").json()["lastAttempt"]["passed"] == 6
    assert len(client.get("/api/coding/attempts?slug=two-sum").json()["attempts"]) == 2
    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    assert client.post(f"/api/coding/attempts/{a['id']}/review").status_code == 404


REVIEW = {"summary": "Uses a hash map.", "correctness_risks": [], "time_complexity": "O(n)",
          "space_complexity": "O(n)", "optimal_complexity": "O(n)", "edge_cases_missed": [],
          "readability": ["Good names"],
          "better_approach": "", "improved_code": "def two_sum(nums, target): ...",
          "interview_tip": "Explain the trade-off.", "score": 95}


def test_review_charges_once_and_records_evidence(client, user, fake_llm):
    fake_llm.push({"summary": "Backend", "requirements": [req("Python"), req("Algorithms")]})
    client.post("/api/readiness/targets", data={"title": "Backend Engineer"})
    a = attempt(client).json()
    before = client.get("/api/auth/me").json()["credits"]
    fake_llm.push(REVIEW)
    r = client.post(f"/api/coding/attempts/{a['id']}/review")
    assert r.status_code == 200 and r.json()["review"]["score"] == 95
    prompt = fake_llm.calls[-1][1]["prompt"]
    assert "<candidate_code>" in prompt and "6 of 6 passed" in prompt
    again = client.post(f"/api/coding/attempts/{a['id']}/review")
    assert again.json()["review"]["score"] == 95
    assert client.get("/api/auth/me").json()["credits"] == before - 1
    with SessionLocal() as db:
        rows = db.query(Evidence).filter(Evidence.source == "coding_practice")
        ev = sorted((e.skill, e.score) for e in rows)
    assert ev == [("Algorithms", 95), ("Python", 95)]


def test_failing_code_score_is_capped(client, user, fake_llm):
    a = attempt(client, passed=2).json()
    fake_llm.push(REVIEW)
    r = client.post(f"/api/coding/attempts/{a['id']}/review")
    assert r.json()["review"]["score"] == 60


def test_review_failure_refunds(client, user, fake_llm):
    a = attempt(client).json()
    fake_llm.push(LLMError())
    assert client.post(f"/api/coding/attempts/{a['id']}/review").status_code == 503
    assert client.get("/api/auth/me").json()["credits"] == 10


def test_pick_oa_prefers_unseen_problems():
    easy = [p["slug"] for p in PROBLEMS if p["difficulty"] == "easy"]
    picked = coding.pick_oa("standard", set(easy[:-1]), random.Random(1))
    assert picked[0] == easy[-1]
    assert coding.find_problem(picked[1])["difficulty"] == "medium"
    assert [coding.find_problem(s)["difficulty"] for s in coding.pick_oa("hard", set())] == ["medium", "hard"]


def test_mock_oa_flow(client, user, monkeypatch):
    s = client.post("/api/coding/oa/start", json={"level": "standard"}).json()
    assert len(s["problems"]) == 2 and 69 * 60 <= s["secondsLeft"] <= 70 * 60
    assert client.post("/api/coding/oa/start", json={"level": "hard"}).json()["id"] == s["id"]  # resumed
    first, second = (p["slug"] for p in s["problems"])
    total = len(coding.find_problem(first)["tests"])
    assert attempt(client, slug=first, passed=total, total=total, session_id=s["id"]).status_code == 201
    assert attempt(client, slug="trapping-rain-water", passed=5, total=5,
                   session_id=s["id"]).status_code == 400  # not in this OA

    real_now = coding.now_utc
    monkeypatch.setattr(coding, "now_utc", lambda: real_now() + timedelta(minutes=72))
    total2 = len(coding.find_problem(second)["tests"])
    late = attempt(client, slug=second, passed=total2, total=total2, session_id=s["id"]).json()
    assert late["late"] is True
    done = client.get(f"/api/coding/oa/{s['id']}").json()
    assert done["status"] == "completed"
    assert done["result"]["solved"] == 1 and done["result"]["score"] == 50
    assert client.get("/api/coding/oa").json()["sessions"][0]["score"] == 50
