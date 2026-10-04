from app.llm import LLMError
from tests.conftest import register


def test_register_login_me(client):
    user = register(client)
    assert user["credits"] == 10
    assert client.get("/api/auth/me").json()["email"] == "ada@example.com"

    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401

    bad = client.post("/api/auth/login", json={"email": "ada@example.com", "password": "nope-nope"})
    assert bad.status_code == 401
    ok = client.post("/api/auth/login", json={"email": "ADA@example.com", "password": "correct-horse-1"})
    assert ok.status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_duplicate_and_weak_password(client):
    register(client)
    assert client.post("/api/auth/register",
                       json={"email": "ada@example.com", "password": "another-pass"}).status_code == 409
    r = client.post("/api/auth/register", json={"email": "b@example.com", "password": "short"})
    assert r.status_code == 422
    assert "password" in r.json()["detail"]


def test_ai_endpoints_require_auth(client):
    assert client.post("/api/chat", json={"messages": [{"role": "user", "content": "hi"}]}).status_code == 401


def test_chat_charges_one_credit(client, user, fake_llm):
    fake_llm.push({"reply": "Hello!"})
    r = client.post("/api/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 200
    assert r.json()["reply"] == "Hello!"
    assert r.headers["X-Credits-Remaining"] == "9"
    assert client.get("/api/auth/me").json()["credits"] == 9


def test_llm_failure_refunds(client, user, fake_llm):
    fake_llm.push(LLMError())
    r = client.post("/api/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 503
    assert client.get("/api/auth/me").json()["credits"] == 10


def test_insufficient_credits_blocks_before_llm(client, user, fake_llm):
    from app.db import SessionLocal
    from app.models import User

    with SessionLocal() as db:
        db.get(User, user["id"]).credits = 0
        db.commit()
    r = client.post("/api/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 402
    assert r.json()["detail"]["code"] == "insufficient_credits"
    assert fake_llm.calls == []


def test_rate_limit(client, user, fake_llm, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "ai_requests_per_minute", 2)
    for _ in range(2):
        fake_llm.push({"reply": "ok"})
        r = client.post("/api/chat", json={"messages": [{"role": "user", "content": "q"}]})
        assert r.status_code == 200
    r = client.post("/api/chat", json={"messages": [{"role": "user", "content": "q"}]})
    assert r.status_code == 429
    assert client.get("/api/auth/me").json()["credits"] == 8
