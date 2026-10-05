"""Razorpay (India) payments over its REST API: orders, payment lookup and signature checks.

All HTTP goes through `http_client()` so tests can swap in an httpx.MockTransport.
"""

from __future__ import annotations

import hashlib
import hmac

import httpx

from ..config import CreditPack, get_settings

API = "https://api.razorpay.com/v1"


class RazorpayError(Exception):
    pass


def http_client() -> httpx.Client:
    s = get_settings()
    return httpx.Client(base_url=API, auth=(s.razorpay_key_id, s.razorpay_key_secret), timeout=15.0)


def _call(method: str, path: str, **kwargs) -> dict:
    try:
        with http_client() as client:
            r = client.request(method, path, **kwargs)
    except httpx.HTTPError as exc:
        raise RazorpayError("Could not reach the payment provider. Please try again.") from exc
    if r.status_code >= 400:
        raise RazorpayError(f"Payment provider error ({r.status_code}).")
    return r.json()


def create_order(pack: CreditPack, user_id: int) -> dict:
    return _call("POST", "/orders", json={
        "amount": pack.price_cents,  # paise
        "currency": "INR",
        "receipt": f"u{user_id}-{pack.id}"[:40],
        "notes": {"user_id": str(user_id), "pack_id": pack.id, "credits": str(pack.credits)},
    })


def fetch_payment(payment_id: str) -> dict:
    return _call("GET", f"/payments/{payment_id}")


def fetch_order(order_id: str) -> dict:
    return _call("GET", f"/orders/{order_id}")


def _hmac(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def checkout_signature_ok(order_id: str, payment_id: str, signature: str) -> bool:
    """The signature Razorpay Checkout returns to the browser after a successful payment."""
    expected = _hmac(get_settings().razorpay_key_secret, f"{order_id}|{payment_id}".encode())
    return hmac.compare_digest(expected, signature or "")


def webhook_signature_ok(body: bytes, signature: str) -> bool:
    expected = _hmac(get_settings().razorpay_webhook_secret, body)
    return hmac.compare_digest(expected, signature or "")
