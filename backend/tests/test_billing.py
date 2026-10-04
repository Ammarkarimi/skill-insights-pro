from app.db import SessionLocal
from app.models import Payment, User
from app.routers.billing import fulfill_checkout


def test_packs_public(client):
    body = client.get("/api/billing/packs").json()
    assert body["paymentsEnabled"] is False
    assert body["packs"] and body["costs"]["chat_message"] == 1


def test_checkout_unavailable_without_stripe(client, user):
    r = client.post("/api/billing/checkout", json={"pack_id": "starter"})
    assert r.status_code == 503


def test_fulfill_is_idempotent(client, user):
    session = {"id": "cs_test_1", "payment_status": "paid", "amount_total": 999, "currency": "usd",
               "metadata": {"user_id": str(user["id"]), "pack_id": "pro", "credits": "120"}}
    with SessionLocal() as db:
        assert fulfill_checkout(db, session) is True
        assert fulfill_checkout(db, session) is False
        assert db.get(User, user["id"]).credits == 130
        assert db.query(Payment).count() == 1
        assert fulfill_checkout(db, {**session, "id": "cs_2", "payment_status": "unpaid"}) is False


def test_webhook_rejects_bad_signature(client, monkeypatch):
    from app.config import get_settings

    s = get_settings()
    monkeypatch.setattr(s, "stripe_secret_key", "sk_test_x")
    monkeypatch.setattr(s, "stripe_webhook_secret", "whsec_x")
    r = client.post("/api/billing/webhook", content=b"{}", headers={"stripe-signature": "t=1,v1=bad"})
    assert r.status_code == 400


def test_health_and_unknown_api(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/api/nope").status_code == 404


def test_signed_webhook_grants_credits_once(client, user, monkeypatch):
    import hashlib
    import hmac
    import json
    import time

    from app.config import get_settings

    s = get_settings()
    monkeypatch.setattr(s, "stripe_secret_key", "sk_test_x")
    monkeypatch.setattr(s, "stripe_webhook_secret", "whsec_test")
    event = {
        "id": "evt_1", "object": "event", "type": "checkout.session.completed",
        "data": {"object": {
            "id": "cs_live_42", "object": "checkout.session", "payment_status": "paid",
            "amount_total": 399, "currency": "usd",
            "metadata": {"user_id": str(user["id"]), "pack_id": "starter", "credits": "40"},
        }},
    }
    payload = json.dumps(event)
    ts = int(time.time())
    sig = hmac.new(b"whsec_test", f"{ts}.{payload}".encode(), hashlib.sha256).hexdigest()
    headers = {"stripe-signature": f"t={ts},v1={sig}", "content-type": "application/json"}
    for _ in range(2):  # Stripe retries must not double-grant
        r = client.post("/api/billing/webhook", content=payload, headers=headers)
        assert r.status_code == 200, r.text
    assert client.get("/api/auth/me").json()["credits"] == 50
    history = client.get("/api/billing/history").json()
    assert history["payments"][0]["credits"] == 40
