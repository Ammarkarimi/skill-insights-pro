import math
import random
from datetime import timedelta
from fractions import Fraction

import pytest

from app.db import SessionLocal
from app.models import Evidence
from app.services import aptitude, aptitude_bank
from app.services.aptitude_bank import num
from tests.test_readiness import req


def expected(item: dict) -> str:
    """Recompute each templated answer from its inputs, independently of the generator."""
    p, topic = item["params"], item["topic"]
    if topic == "Percentages":
        return f"${num(p['price'] * (1 + p['up'] / 100) * (1 - p['down'] / 100))}"
    if topic == "Ratio and proportion":
        return f"${p['total'] * p['n'] // (p['m'] + p['n']):,}"
    if topic == "Averages":
        return num(Fraction(p["avg"] * p["count"] - p["removed"], p["count"] - 1))
    if topic == "Time, speed and distance":
        return num(Fraction((p["length"] + p["platform"]) * 18, p["speed"] * 5))
    if topic == "Time and work":
        return num(Fraction(1, 1) / (Fraction(1, p["a"]) + Fraction(1, p["b"])))
    if topic == "Profit and loss":
        return f"{num(abs(p['sell'] - p['cost']) * 100 / p['cost'])}%"
    if topic in ("Simple interest", "Compound interest"):
        if p["compound"]:
            return f"${num(p['principal'] * ((1 + p['rate'] / 100) ** p['years'] - 1))}"
        return f"${num(p['principal'] * p['rate'] * p['years'] / 100)}"
    if topic == "Probability":
        if p["dice"]:
            ways = sum(1 for a in range(1, 7) for b in range(1, 7) if a + b == p["target"])
            return num(Fraction(ways, 36))
        return num(Fraction(math.comb(p["flips"], p["heads"]), 2 ** p["flips"]))
    if topic == "Number series":
        return str(p["seq"][5])
    if topic == "Letter series":
        return chr(65 + p["start"] + p["step"] * 4)
    if topic == "Coding-decoding":
        return "".join(chr(65 + (ord(c) - 65 + p["shift"]) % 26) for c in p["target"])
    if topic == "Clocks":
        raw = abs(30 * p["hour"] - 5.5 * p["minute"])
        return f"{num(min(raw, 360 - raw))}°"
    raise AssertionError(f"no checker for {topic}")


@pytest.mark.parametrize("gen", aptitude_bank.QUANT + aptitude_bank.LOGICAL, ids=lambda g: g.__name__)
def test_every_template_answer_is_correct(gen):
    rng = random.Random(7)
    for level in (1, 2, 3):
        for _ in range(150):
            item = gen(rng, level)
            opts = item["options"]
            assert set(opts) == {"A", "B", "C", "D"}
            assert len(set(opts.values())) == 4, item
            assert opts[item["answer"]] == expected(item), item


def test_answer_letters_are_spread():
    items = aptitude_bank.generate("quant", 400, 2, random.Random(3))
    counts = {k: sum(1 for i in items if i["answer"] == k) for k in "ABCD"}
    assert min(counts.values()) > 60


def test_generate_rotates_topics_without_repeats():
    items = aptitude_bank.generate("logical", 12, 2, random.Random(1))
    assert len(items) == 12 and len({i["question"] for i in items}) == 12
    assert {i["topic"] for i in items} == {"Number series", "Letter series", "Coding-decoding", "Clocks"}


# ---------------------------------------------------------------- AI items
def ai_item(section, n, answer="B", passage=""):
    return {"section": section, "topic": "Syllogism" if section == "logical" else "Reading comprehension",
            "passage": passage, "question": f"{section} question {n}?",
            "options": [{"key": k, "text": f"{section} {n} option {k}"} for k in "ABCD"],
            "answer": answer, "explanation": "Because."}


def solve_all(fake_llm, wrong=()):
    """Queue a solver reply that agrees with every key except the given question numbers."""
    def reply(schema, **kwargs):
        fake_llm.calls.append((schema, kwargs))
        prompt = kwargs["prompt"]
        out = []
        for i, block in enumerate(prompt.split("<question number=")[1:], 1):
            # The correct option text always ends with ' option B' before shuffling.
            letter = next(line[0] for line in block.splitlines() if line.endswith(" option B"))
            out.append({"number": i, "answer": "A" if (i in wrong and letter != "A") else
                        ("C" if i in wrong else letter)})
        return schema.model_validate({"answers": out})
    return reply


@pytest.fixture
def solver(fake_llm, monkeypatch):
    """First call returns queued items; second call is the independent solver."""
    state = {"wrong": ()}

    def generate(schema, **kwargs):
        if schema is aptitude.SolvedSet:
            return solve_all(fake_llm, state["wrong"])(schema, **kwargs)
        return fake_llm(schema, **kwargs)
    monkeypatch.setattr(aptitude, "generate", generate)
    return state


def credits(client):
    return client.get("/api/auth/me").json()["credits"]


def start(client, section="quant", difficulty="medium"):
    r = client.post("/api/aptitude/start", json={"section": section, "difficulty": difficulty})
    assert r.status_code == 201, r.text
    return r.json()


def test_quant_test_is_free_and_hides_the_key(client, user, fake_llm):
    test = start(client, "quant")
    assert test["total"] == 20 and len(test["questions"]) == 20
    assert fake_llm.calls == [] and credits(client) == 10
    q = test["questions"][0]
    assert set(q) == {"id", "section", "topic", "question", "passage", "options"}
    assert 20 * 75 - 5 <= test["secondsLeft"] <= 20 * 75


def test_verbal_keeps_only_verified_items(client, user, fake_llm, solver):
    fake_llm.push({"questions": [ai_item("verbal", i, passage="A short passage.") for i in range(30)]})
    solver["wrong"] = {1, 2, 3, 4, 5}
    test = start(client, "verbal")
    assert credits(client) == 8
    assert test["total"] == 20  # 30 generated, 25 verified, 20 used
    assert all(q["passage"] == "A short passage." for q in test["questions"])
    prompt = fake_llm.calls[-1][1]["prompt"]
    assert "option" in prompt and "explanation" not in prompt.lower()


def test_too_few_verified_items_refunds(client, user, fake_llm, solver):
    fake_llm.push({"questions": [ai_item("verbal", i) for i in range(12)]})
    solver["wrong"] = set(range(1, 8))
    r = client.post("/api/aptitude/start", json={"section": "verbal", "difficulty": "easy"})
    assert r.status_code == 502
    assert credits(client) == 10


def test_logical_shortfall_is_filled_with_templates(client, user, fake_llm, solver):
    fake_llm.push({"questions": [ai_item("logical", i) for i in range(4)]})
    test = start(client, "logical")
    sources = [q["topic"] for q in test["questions"]]
    assert test["total"] == 20 and sources.count("Syllogism") == 4


def test_answer_submit_and_grade(client, user, fake_llm):
    test = start(client)
    with SessionLocal() as db:
        from app.models import AptitudeTest
        key = {q["id"]: q["answer"] for q in db.get(AptitudeTest, test["id"]).questions}
    for qid in list(key)[:10]:
        r = client.post(f"/api/aptitude/{test['id']}/answer", json={"question_id": qid, "answer": key[qid]})
        assert r.status_code == 200
    wrong = next(k for k in "ABCD" if k != key[11])
    client.post(f"/api/aptitude/{test['id']}/answer", json={"question_id": 11, "answer": wrong})
    done = client.post(f"/api/aptitude/{test['id']}/submit").json()
    res = done["result"]
    assert res["correct"] == 10 and res["answered"] == 11 and res["score"] == 50
    assert res["perSection"]["quant"]["total"] == 20
    assert res["review"][0]["explanation"] and "params" not in res["review"][0]
    assert client.post(f"/api/aptitude/{test['id']}/answer",
                       json={"question_id": 1, "answer": "A"}).status_code == 409
    assert client.get("/api/aptitude").json()["tests"][0]["score"] == 50


def test_bad_answers_rejected(client, user, fake_llm):
    test = start(client)
    url = f"/api/aptitude/{test['id']}/answer"
    assert client.post(url, json={"question_id": 999, "answer": "A"}).status_code == 400
    assert client.post(url, json={"question_id": 1, "answer": "E"}).status_code == 422


def test_deadline_is_enforced(client, user, fake_llm, monkeypatch):
    test = start(client)
    real_now = aptitude.now_utc
    monkeypatch.setattr(aptitude, "now_utc", lambda: real_now() + timedelta(seconds=20 * 75 + 31))
    r = client.post(f"/api/aptitude/{test['id']}/answer", json={"question_id": 1, "answer": "A"})
    assert r.status_code == 409
    assert client.get(f"/api/aptitude/{test['id']}").json()["status"] == "completed"


def test_active_test_is_resumed_not_recharged(client, user, fake_llm, solver):
    fake_llm.push({"questions": [ai_item("verbal", i) for i in range(30)]})
    first = start(client, "verbal")
    second = start(client, "mixed")
    assert second["id"] == first["id"] and credits(client) == 8


def test_evidence_only_for_matching_requirements(client, user, fake_llm):
    fake_llm.push({"summary": "Analyst", "requirements": [req("Problem solving", aliases=["problem-solving"]),
                                                           req("SQL")]})
    client.post("/api/readiness/targets", data={"title": "Analyst"})
    test = start(client)
    client.post(f"/api/aptitude/{test['id']}/submit")
    with SessionLocal() as db:
        ev = db.query(Evidence).filter(Evidence.source == "aptitude").all()
    assert [(e.skill, e.score) for e in ev] == [("Problem solving", 0)]
