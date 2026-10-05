import hashlib
import hmac
import json

import httpx
import pytest

from app.config import get_settings
from app.db import SessionLocal
from app.models import Payment
from app.services import razorpay
from tests.conftest import register

KEY_SECRET = "rzp_secret_test"
WEBHOOK_SECRET = "rzp_webhook_test"


@pytest.fixture
def rzp(monkeypatch):
    """Razorpay enabled, with its API served by an in-memory fake."""
    s = get_settings()
    monkeypatch.setattr(s, "razorpay_key_id", "rzp_test_key")
    monkeypatch.setattr(s, "razorpay_key_secret", KEY_SECRET)
    monkeypatch.setattr(s, "razorpay_webhook_secret", WEBHOOK_SECRET)
    state = {"orders": {}, "payments": {}, "fail": False}

    def handler(request: httpx.Request) -> httpx.Response:
        if state["fail"]:
            return httpx.Response(500, json={"error": "down"})
        path = request.url.path.removeprefix("/v1")
        if request.method == "POST" and path == "/orders":
            body = json.loads(request.content)
            order = {"id": f"order_{len(state['orders']) + 1}", "amount": body["amount"], "currency": "INR",
                     "notes": body["notes"], "status": "created"}
            state["orders"][order["id"]] = order
            return httpx.Response(200, json=order)
        if path.startswith("/orders/"):
            order = state["orders"].get(path.split("/")[-1])
            return httpx.Response(200, json=order) if order else httpx.Response(404, json={})
        if path.startswith("/payments/"):
            payment = state["payments"].get(path.split("/")[-1])
            return httpx.Response(200, json=payment) if payment else httpx.Response(404, json={})
        return httpx.Response(404, json={})

    transport = httpx.MockTransport(handler)
    monkeypatch.setattr(razorpay, "http_client",
                        lambda: httpx.Client(base_url=razorpay.API, transport=transport))

    def pay(order_id, status="captured", amount=None):
        pid = f"pay_{len(state['payments']) + 1}"
        paid = amount if amount is not None else state["orders"][order_id]["amount"]
        state["payments"][pid] = {"id": pid, "order_id": order_id, "status": status, "currency": "INR",
                                  "amount": paid}
        return pid
    state["pay"] = pay
    return state


def sign(order_id, payment_id, secret=KEY_SECRET):
    return hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


def credits(client):
    return client.get("/api/auth/me").json()["credits"]


def order(client, pack="inr-pro"):
    r = client.post("/api/billing/razorpay/order", json={"pack_id": pack})
    assert r.status_code == 200, r.text
    return r.json()


def verify(client, order_id, payment_id, signature=None):
    return client.post("/api/billing/razorpay/verify", json={
        "order_id": order_id, "payment_id": payment_id, "signature": signature or sign(order_id, payment_id)})


def test_packs_expose_inr_only_when_enabled(client, monkeypatch):
    body = client.get("/api/billing/packs").json()
    assert body["inr"]["enabled"] is False and body["inr"]["keyId"] == ""
    assert [p["price_cents"] for p in body["inr"]["packs"]] == [4900, 9900, 24900, 49900]


def test_disabled_returns_503(client, user):
    assert client.post("/api/billing/razorpay/order", json={"pack_id": "inr-pro"}).status_code == 503


def test_order_then_verify_grants_once(client, user, rzp):
    o = order(client)
    assert o["amount"] == 24900 and o["keyId"] == "rzp_test_key"
    assert o["prefill"]["email"] == "ada@example.com"
    assert rzp["orders"][o["orderId"]]["notes"] == {"user_id": str(user["id"]), "pack_id": "inr-pro",
                                                     "credits": "120"}
    pid = rzp["pay"](o["orderId"])
    r = verify(client, o["orderId"], pid)
    assert r.json() == {"paid": True, "pending": False, "credits": 130}
    assert verify(client, o["orderId"], pid).json()["credits"] == 130  # idempotent
    history = client.get("/api/billing/history").json()["payments"]
    assert history[0]["currency"] == "inr" and history[0]["amountCents"] == 24900


def test_bad_signature_and_unknown_pack(client, user, rzp):
    o = order(client)
    pid = rzp["pay"](o["orderId"])
    assert verify(client, o["orderId"], pid, signature="0" * 64).status_code == 400
    assert verify(client, o["orderId"], pid, signature=sign(o["orderId"], pid, "wrong")).status_code == 400
    assert client.post("/api/billing/razorpay/order", json={"pack_id": "pro"}).status_code == 404
    assert credits(client) == 10


def test_authorized_payment_is_pending(client, user, rzp):
    o = order(client)
    pid = rzp["pay"](o["orderId"], status="authorized")
    assert verify(client, o["orderId"], pid).json() == {"paid": False, "pending": True, "credits": 10}


def test_amount_mismatch_is_not_granted(client, user, rzp):
    o = order(client)
    pid = rzp["pay"](o["orderId"], amount=100)
    assert verify(client, o["orderId"], pid).json()["paid"] is True  # Razorpay says captured...
    assert credits(client) == 10  # ...but we never grant a payment that does not match the order


def test_cannot_claim_someone_elses_order(client, user, rzp):
    o = order(client)
    pid = rzp["pay"](o["orderId"])
    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    assert verify(client, o["orderId"], pid).status_code == 404
    assert credits(client) == 10


def test_provider_outage_is_reported(client, user, rzp):
    rzp["fail"] = True
    assert client.post("/api/billing/razorpay/order", json={"pack_id": "inr-pro"}).status_code == 502


def webhook(client, event, secret=WEBHOOK_SECRET):
    body = json.dumps(event).encode()
    sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return client.post("/api/billing/razorpay/webhook", content=body,
                       headers={"x-razorpay-signature": sig, "content-type": "application/json"})


def test_webhook_grants_and_then_verify_does_not_double_grant(client, user, rzp):
    o = order(client)
    pid = rzp["pay"](o["orderId"])
    payment = rzp["payments"][pid]
    event = {"event": "payment.captured", "payload": {"payment": {"entity": payment}}}
    assert webhook(client, event, secret="nope").status_code == 400
    assert credits(client) == 10
    assert webhook(client, event).status_code == 200
    assert webhook(client, event).status_code == 200  # retries are harmless
    assert credits(client) == 130
    assert verify(client, o["orderId"], pid).json()["credits"] == 130
    with SessionLocal() as db:
        assert db.query(Payment).filter(Payment.provider == "razorpay").count() == 1


def test_order_paid_event_uses_embedded_order(client, user, rzp):
    o = order(client, "inr-mini")
    pid = rzp["pay"](o["orderId"])
    event = {"event": "order.paid", "payload": {"payment": {"entity": rzp["payments"][pid]},
                                                "order": {"entity": rzp["orders"][o["orderId"]]}}}
    rzp["fail"] = True  # no API call is needed when the order comes with the event
    assert webhook(client, event).status_code == 200
    assert credits(client) == 25
