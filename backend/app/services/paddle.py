"""Paddle Billing (merchant of record) over its REST API: transactions and webhook signatures.

Paddle sells to the customer on our behalf, so it charges and files VAT (UK, EU), GST (Australia)
and US sales tax. We create a transaction with our own price for the pack, the browser opens Paddle
Checkout for it, and credits are granted when Paddle reports it paid (webhook or confirm call).

All HTTP goes through `http_client()` so tests can swap in an httpx.MockTransport.
"""

from __future__ import annotations

import hashlib
import hmac
import time

import httpx

from ..config import CreditPack, get_settings

LIVE_API = "https://api.paddle.com"
SANDBOX_API = "https://sandbox-api.paddle.com"
PAID = ("paid", "completed")
SIGNATURE_TOLERANCE_SECONDS = 300


class PaddleError(Exception):
    pass


def http_client() -> httpx.Client:
    s = get_settings()
    return httpx.Client(base_url=SANDBOX_API if s.paddle_sandbox else LIVE_API, timeout=15.0,
                        headers={"Authorization": f"Bearer {s.paddle_api_key}"})


def _call(method: str, path: str, **kwargs) -> dict:
    try:
        with http_client() as client:
            r = client.request(method, path, **kwargs)
    except httpx.HTTPError as exc:
        raise PaddleError("Could not reach the payment provider. Please try again.") from exc
    if r.status_code >= 400:
        detail = ""
        try:
            detail = (r.json().get("error") or {}).get("detail", "")
        except ValueError:
            pass
        raise PaddleError(f"Payment provider error ({r.status_code}). {detail}".strip())
    return r.json()["data"]


def price_of(pack: CreditPack, currency: str) -> int | None:
    return pack.prices.get(currency.lower())


def create_transaction(pack: CreditPack, currency: str, user_id: int, consent: bool) -> dict:
    s = get_settings()
    amount = price_of(pack, currency)
    if amount is None:
        raise PaddleError("This pack is not sold in that currency.")
    price: dict = {
        "name": f"{pack.name}: {pack.credits} credits",
        "description": f"{s.app_name} {pack.name} pack ({pack.credits} credits)",
        "unit_price": {"amount": str(amount), "currency_code": currency.upper()},
        "tax_mode": "internal" if s.is_tax_inclusive(currency) else "external",
    }
    if s.paddle_product_id:
        price["product_id"] = s.paddle_product_id
    else:
        price["product"] = {"name": f"{s.app_name} credits", "tax_category": s.paddle_tax_category}
    return _call("POST", "/transactions", json={
        "items": [{"quantity": 1, "price": price}],
        "currency_code": currency.upper(),
        "collection_mode": "automatic",
        "custom_data": {"user_id": str(user_id), "pack_id": pack.id, "credits": str(pack.credits),
                        "supply_consent": "yes" if consent else "no"},
    })


def get_transaction(transaction_id: str) -> dict:
    return _call("GET", f"/transactions/{transaction_id}")


def paid_amount(txn: dict) -> tuple[int, int]:
    """(unit price we charged for the pack, total the customer paid) in minor units."""
    items = (txn.get("items") or [{}])
    unit = ((items[0].get("price") or {}).get("unit_price") or {}).get("amount") or 0
    totals = (txn.get("details") or {}).get("totals") or {}
    return int(unit), int(totals.get("total") or totals.get("grand_total") or 0)


def webhook_signature_ok(body: bytes, header: str, now: float | None = None) -> bool:
    """Paddle-Signature: "ts=1671552777;h1=<hex HMAC-SHA256 of 'ts:body'>"."""
    parts = dict(p.split("=", 1) for p in (header or "").split(";") if "=" in p)
    ts, sig = parts.get("ts", ""), parts.get("h1", "")
    if not ts.isdigit() or not sig:
        return False
    if abs((now or time.time()) - int(ts)) > SIGNATURE_TOLERANCE_SECONDS:
        return False
    secret = get_settings().paddle_webhook_secret.encode()
    expected = hmac.new(secret, f"{ts}:".encode() + body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)
