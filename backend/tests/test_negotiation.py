import json

from app.services import negotiation as svc
from tests.conftest import register


def scenario(**over):
    base = {"company_description": "A fintech scale-up.", "recruiter_name": "Riley",
            "recruiter_style": "firm",
            "currency": "usd", "market_low": 120000, "market_mid": 140000, "market_high": 160000,
            "initial_base": 130000, "initial_signing": 5000, "initial_bonus_pct": 10,
            "max_base": 145000, "max_signing": 20000, "max_bonus_pct": 15, "equity_note": "",
            "flexible_levers": ["start date", "remote days"],
            "opening_message": "Hi! We'd love to offer you..."}
    return {**base, **over}


def turn(base, signing=5000, bonus=10, status="negotiating", other=()):
    return {"reply": "Let me see what I can do.", "offer_base": base, "offer_signing": signing,
            "offer_bonus_pct": bonus, "other_changes": list(other), "status": status}


def start(client, fake_llm, **over):
    fake_llm.push(scenario(**over))
    r = client.post("/api/negotiation/start", json={"role_title": "Backend Engineer", "level": "senior",
                                                    "location": "Austin, TX", "company_type": "startup"})
    assert r.status_code == 201, r.text
    return r.json()


def say(client, nid, text="I was hoping for something closer to the market median."):
    return client.post(f"/api/negotiation/{nid}/message", json={"text": text})


def test_clamp_scenario_and_user_offer():
    s = svc._clamp_scenario(svc.ScenarioLLM.model_validate(scenario(max_base=999999, currency="eur")), None)
    assert s["max_base"] == round(130000 * 1.3) and s["currency"] == "EUR"
    s = svc._clamp_scenario(svc.ScenarioLLM.model_validate(scenario()), your_offer=100000)
    assert s["initial_base"] == 100000 and 103000 <= s["max_base"] <= 125000


def test_start_hides_the_budget(client, user, fake_llm):
    body = start(client, fake_llm)
    dumped = json.dumps(body)
    assert "max_base" not in dumped and "145000" not in dumped and "flexible_levers" not in dumped
    assert body["offer"] == {"base": 130000, "signing": 5000, "bonusPct": 10, "other": []}
    assert body["transcript"][0]["role"] == "recruiter"
    assert client.get("/api/auth/me").json()["credits"] == 8
    assert "Location: Austin, TX" in fake_llm.calls[0][1]["prompt"]


def test_offers_are_clamped_and_never_decrease(client, user, fake_llm):
    nid = start(client, fake_llm)["id"]
    fake_llm.push(turn(200000, signing=50000, bonus=40, other=["+2 remote days"]))  # over the ceiling
    body = say(client, nid).json()
    assert body["offer"] == {"base": 145000, "signing": 20000, "bonusPct": 15, "other": ["+2 remote days"]}
    fake_llm.push(turn(120000, signing=0, bonus=0))  # tries to go below the current offer
    body = say(client, nid).json()
    assert body["offer"]["base"] == 145000 and body["offer"]["signing"] == 20000
    assert body["messagesLeft"] == svc.MAX_MESSAGES - 2
    assert client.get("/api/auth/me").json()["credits"] == 8  # turns are free
    system = fake_llm.calls[-1][1]["system"]
    assert "base up to 145000" in system  # the recruiter knows its limits; the user does not


def test_final_offer_ends_the_call(client, user, fake_llm):
    nid = start(client, fake_llm)["id"]
    fake_llm.push(turn(138000, status="final_offer"))
    assert say(client, nid).json()["status"] == "final"
    assert say(client, nid).status_code == 409


def test_message_cap(client, user, fake_llm, monkeypatch):
    monkeypatch.setattr(svc, "MAX_MESSAGES", 2)
    nid = start(client, fake_llm)["id"]
    for _ in range(2):
        fake_llm.push(turn(131000))
        body = say(client, nid).json()
    assert body["status"] == "final" and body["messagesLeft"] == 0


def report():
    skills = ["anchoring", "justification", "non_salary_levers", "tone", "handling_pressure", "closing"]
    return {"overall_score": 72, "summary": "Good anchor.",
            "skills": [{"skill": s, "score": 12, "feedback": "f"} for s in skills],
            "key_moments": [{"quote": "q", "assessment": "a", "better_alternative": "b"}],
            "scripts": {"counter_offer_email": "Dear Riley...", "phone_opener": "Thanks...",
                        "closing_line": "Could you send that in writing?"}}


def test_finish_reveals_ceiling_and_scores_outcome(client, user, fake_llm):
    nid = start(client, fake_llm)["id"]
    assert client.post(f"/api/negotiation/{nid}/finish").status_code == 400  # must respond first
    fake_llm.push(turn(137500, signing=12500))
    say(client, nid)
    fake_llm.push(report())
    r = client.post(f"/api/negotiation/{nid}/finish")
    assert r.status_code == 200, r.text
    rep = r.json()["report"]
    out = rep["outcome"]
    assert out["ceiling"] == {"base": 145000, "signing": 20000, "bonusPct": 15}
    assert out["baseCapturedPct"] == 50  # 7,500 of 15,000 room
    # first year: 130000+5000+13000=148000 -> 137500+12500+13750=163750; max 145000+20000+21750=186750
    assert out["firstYearGain"] == 15750 and out["totalCapturedPct"] == round(100 * 15750 / 38750)
    assert all(s["score"] == 10 for s in rep["skills"])
    assert rep["market"]["market_mid"] == 140000
    assert client.get("/api/auth/me").json()["credits"] == 6
    again = client.post(f"/api/negotiation/{nid}/finish").json()  # idempotent, free
    assert again["status"] == "completed" and client.get("/api/auth/me").json()["credits"] == 6
    hist = client.get("/api/negotiation").json()["negotiations"]
    assert hist[0]["score"] == 72 and hist[0]["gain"] == 15750


def test_negotiations_are_private(client, user, fake_llm):
    nid = start(client, fake_llm)["id"]
    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    assert client.get(f"/api/negotiation/{nid}").status_code == 404
    assert say(client, nid).status_code == 404


def test_schemas_are_strict_compatible():
    from openai.lib._parsing._responses import type_to_text_format_param

    for schema in (svc.ScenarioLLM, svc.RecruiterTurn, svc.NegotiationReport):
        assert type_to_text_format_param(schema)["strict"] is True
