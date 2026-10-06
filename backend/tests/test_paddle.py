import hashlib
import hmac
import itertools
import json
import time

import httpx
import pytest

from app.config import get_settings
from app.db import SessionLocal
from app.models import Payment
from app.routers.billing import fulfill_checkout
from app.services import paddle
from tests.conftest import register

SECRET = "pdl_ntfset_test_secret"


@pytest.fixture
def pdl(monkeypatch):
    """A fake Paddle API: transactions are created 'ready' and paid with pay(id)."""
    s = get_settings()
    monkeypatch.setattr(s, "paddle_api_key", "pdl_sdbx_apikey_test")
    monkeypatch.setattr(s, "paddle_client_token", "test_client_token")
    monkeypatch.setattr(s, "paddle_webhook_secret", SECRET)
    state = {"txns": {}, "requests": []}
    ids = itertools.count(1)

    def handler(request: httpx.Request) -> httpx.Response:
        state["requests"].append(request)
        assert request.headers["authorization"] == "Bearer pdl_sdbx_apikey_test"
        if request.method == "POST" and request.url.path == "/transactions":
            body = json.loads(request.content)
            price = body["items"][0]["price"]
            unit = int(price["unit_price"]["amount"])
            total = unit if price["tax_mode"] == "internal" else unit + unit // 10  # +10% US sales tax
            txn = {"id": f"txn_{next(ids):026d}", "status": "ready", "currency_code": body["currency_code"],
                   "custom_data": body["custom_data"], "items": [{"price": price, "quantity": 1}],
                   "details": {"totals": {"total": str(total), "currency_code": body["currency_code"]}}}
            state["txns"][txn["id"]] = txn
            return httpx.Response(201, json={"data": txn})
        if request.method == "GET" and request.url.path.startswith("/transactions/"):
            txn = state["txns"].get(request.url.path.rsplit("/", 1)[1])
            if txn is None:
                return httpx.Response(404, json={"error": {"detail": "not found"}})
            return httpx.Response(200, json={"data": txn})
        return httpx.Response(404, json={"error": {"detail": "no route"}})

    def client():
        return httpx.Client(base_url=paddle.SANDBOX_API, transport=httpx.MockTransport(handler),
                            headers={"Authorization": f"Bearer {s.paddle_api_key}"})

    monkeypatch.setattr(paddle, "http_client", client)

    def pay(txn_id, status="completed"):
        state["txns"][txn_id]["status"] = status
        return state["txns"][txn_id]

    state["pay"] = pay
    return state


def start(client, pack="pro", currency="gbp", consent=True):
    return client.post("/api/billing/paddle/transaction",
                       json={"pack_id": pack, "currency": currency, "consent": consent})


def confirm(client, txn_id):
    return client.post("/api/billing/paddle/confirm", json={"transaction_id": txn_id})


def signed(body: dict, ts: int | None = None, secret: str = SECRET) -> tuple[bytes, dict]:
    raw = json.dumps(body).encode()
    ts = ts or int(time.time())
    sig = hmac.new(secret.encode(), f"{ts}:".encode() + raw, hashlib.sha256).hexdigest()
    return raw, {"Paddle-Signature": f"ts={ts};h1={sig}", "Content-Type": "application/json"}


def credits(client):
    return client.get("/api/auth/me").json()["credits"]


def test_packs_show_local_prices_and_provider(client, pdl):
    body = client.get("/api/billing/packs").json()
    assert body["cardProvider"] == "paddle" and body["paymentsEnabled"] is True
    assert body["paddle"] == {"enabled": True, "environment": "sandbox", "clientToken": "test_client_token",
                              "currencies": ["usd", "gbp", "eur", "aud"],
                              "taxInclusive": ["gbp", "eur", "aud"]}
    pro = next(p for p in body["packs"] if p["id"] == "pro")
    assert pro["prices"] == {"usd": 999, "gbp": 799, "eur": 899, "aud": 1499}


def test_packs_without_paddle(client):
    body = client.get("/api/billing/packs").json()
    assert body["cardProvider"] is None and body["paddle"]["clientToken"] == ""
    assert start(client).status_code == 401  # signed out
    register(client)
    assert start(client).status_code == 503


def test_transaction_needs_consent_and_a_sold_currency(client, user, pdl):
    r = start(client, consent=False)
    assert r.status_code == 400 and "right to cancel" in r.json()["detail"]
    assert start(client, currency="jpy").status_code == 400
    assert start(client, pack="nope").status_code == 404
    assert pdl["requests"] == []  # nothing reached Paddle


def test_transaction_carries_our_price_and_tax_mode(client, user, pdl, monkeypatch):
    r = start(client, currency="gbp")
    assert r.status_code == 200 and r.json()["email"] == "ada@example.com"
    sent = json.loads(pdl["requests"][-1].content)
    price = sent["items"][0]["price"]
    assert price["unit_price"] == {"amount": "799", "currency_code": "GBP"}
    assert price["tax_mode"] == "internal" and price["product"]["tax_category"] == "standard"
    assert sent["custom_data"] == {"user_id": str(user["id"]), "pack_id": "pro", "credits": "120",
                                   "supply_consent": "yes"}
    monkeypatch.setattr(get_settings(), "paddle_product_id", "pro_01h000000000000000000000")
    start(client, currency="usd")
    price = json.loads(pdl["requests"][-1].content)["items"][0]["price"]
    assert price["tax_mode"] == "external" and price["product_id"].startswith("pro_")
    assert "product" not in price
    assert str(pdl["requests"][-1].url).startswith(paddle.SANDBOX_API)


def test_confirm_grants_once_when_paid(client, user, pdl):
    txn = start(client, currency="aud").json()["transactionId"]
    body = confirm(client, txn).json()
    assert (body["paid"], body["pending"], body["credits"]) == (False, True, 10)
    pdl["pay"](txn)
    assert confirm(client, txn).json() == {"paid": True, "pending": False, "credits": 130,
                                           "amountCents": 1499, "currency": "aud", "ref": txn}
    assert confirm(client, txn).json()["credits"] == 130  # idempotent
    with SessionLocal() as db:
        payment = db.query(Payment).one()
    assert (payment.provider, payment.currency, payment.amount_cents) == ("paddle", "aud", 1499)
    assert payment.supply_consent is True


def test_confirm_only_for_the_buyer(client, user, pdl):
    txn = start(client).json()["transactionId"]
    pdl["pay"](txn)
    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    assert confirm(client, txn).status_code == 404
    assert confirm(client, "txn_missing").status_code == 404
    assert credits(client) == 10


def test_signed_webhook_grants_once(client, user, pdl):
    txn = start(client, currency="usd").json()["transactionId"]
    event = {"event_type": "transaction.completed", "data": pdl["pay"](txn)}
    raw, headers = signed(event)
    for _ in range(2):  # Paddle retries; one grant
        assert client.post("/api/billing/paddle/webhook", content=raw, headers=headers).status_code == 200
    assert credits(client) == 130
    with SessionLocal() as db:
        assert db.query(Payment).one().amount_cents == 999 + 99  # what the customer paid, with US tax


def test_webhook_rejects_bad_or_stale_signatures(client, user, pdl):
    txn = start(client).json()["transactionId"]
    event = {"event_type": "transaction.completed", "data": pdl["pay"](txn)}
    for raw, headers in (signed(event, secret="wrong"), signed(event, ts=int(time.time()) - 3600)):
        assert client.post("/api/billing/paddle/webhook", content=raw, headers=headers).status_code == 400
    raw, _ = signed(event)
    assert client.post("/api/billing/paddle/webhook", content=raw,
                       headers={"Paddle-Signature": "garbage"}).status_code == 400
    assert credits(client) == 10


def test_edited_custom_data_cannot_upgrade_the_pack(client, user, pdl):
    txn = start(client, pack="starter", currency="gbp").json()["transactionId"]
    paid = pdl["pay"](txn)
    paid["custom_data"]["pack_id"] = "power"  # paid £3.49, claims the £15.99 pack
    raw, headers = signed({"event_type": "transaction.completed", "data": paid})
    client.post("/api/billing/paddle/webhook", content=raw, headers=headers)
    assert credits(client) == 10


def test_stripe_checkout_needs_consent_and_records_it(client, user, monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "stripe_secret_key", "sk_test_x")
    monkeypatch.setattr(s, "stripe_webhook_secret", "whsec_x")
    r = client.post("/api/billing/checkout", json={"pack_id": "pro"})
    assert r.status_code == 400 and "right to cancel" in r.json()["detail"]
    with SessionLocal() as db:
        fulfill_checkout(db, {"id": "cs_1", "payment_status": "paid", "amount_total": 999, "currency": "usd",
                              "metadata": {"user_id": str(user["id"]), "pack_id": "pro", "credits": "120",
                                           "supply_consent": "yes"}})
        assert db.query(Payment).one().supply_consent is True
