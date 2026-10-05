"""Credit packs: Stripe Checkout (USD) and Razorpay (INR: UPI, cards, netbanking), with webhooks."""

from __future__ import annotations

import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import Payment, UsageEvent, User
from ..security import current_user
from ..services import razorpay

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/billing", tags=["billing"])


def _stripe() -> stripe.StripeClient:
    settings = get_settings()
    if not settings.payments_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            "Payments are not configured yet. Please try again later.")
    return stripe.StripeClient(settings.stripe_secret_key)


@router.get("/packs")
def packs() -> dict:
    settings = get_settings()
    return {
        "currency": settings.currency,
        "packs": [p.model_dump() for p in settings.credit_packs],
        "costs": settings.action_costs,
        "freeSignupCredits": settings.free_signup_credits,
        "paymentsEnabled": settings.payments_enabled,
        "inr": {
            "enabled": settings.razorpay_enabled,
            "currency": "inr",
            "packs": [p.model_dump() for p in settings.inr_credit_packs],
            "keyId": settings.razorpay_key_id if settings.razorpay_enabled else "",
        },
    }


class CheckoutIn(BaseModel):
    pack_id: str


@router.post("/checkout")
def checkout(body: CheckoutIn, user: User = Depends(current_user)) -> dict:
    settings = get_settings()
    pack = next((p for p in settings.credit_packs if p.id == body.pack_id), None)
    if pack is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown credit pack.")
    client = _stripe()
    session = client.v1.checkout.sessions.create(params={
        "mode": "payment",
        "customer_email": user.email,
        "client_reference_id": str(user.id),
        "line_items": [{
            "quantity": 1,
            "price_data": {
                "currency": settings.currency,
                "unit_amount": pack.price_cents,
                "product_data": {
                    "name": f"{settings.app_name} {pack.name}: {pack.credits} credits",
                    "description": pack.description or None,
                },
            },
        }],
        "metadata": {"user_id": str(user.id), "pack_id": pack.id, "credits": str(pack.credits)},
        "success_url": f"{settings.app_url}/billing?status=success&session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{settings.app_url}/billing?status=cancelled",
    })
    return {"url": session.url}


def grant_credits(db: Session, *, user_id: int, provider: str, provider_ref: str, pack_id: str,
                  credits: int, amount_cents: int, currency: str) -> bool:
    """Record a payment and add its credits. Idempotent per provider_ref; True if newly granted."""
    if db.get(User, user_id) is None:
        log.error("%s payment %s references unknown user %s", provider, provider_ref, user_id)
        return False
    try:
        db.add(Payment(user_id=user_id, provider=provider, provider_ref=provider_ref, pack_id=pack_id,
                       credits=credits, amount_cents=amount_cents, currency=currency))
        db.execute(update(User).where(User.id == user_id).values(credits=User.credits + credits))
        db.commit()
    except IntegrityError:  # already fulfilled (webhook retry, or webhook and browser both confirmed)
        db.rollback()
        return False
    log.info("Granted %s credits to user %s (%s %s)", credits, user_id, provider, provider_ref)
    return True


def fulfill_checkout(db: Session, session: dict) -> bool:
    """Grant credits for a paid Stripe Checkout Session. Idempotent; True if newly granted."""
    if session.get("payment_status") != "paid":
        return False
    metadata = session.get("metadata") or {}
    try:
        user_id = int(metadata["user_id"])
        credits = int(metadata["credits"])
    except (KeyError, TypeError, ValueError):
        log.error("Checkout session %s has no usable metadata", session.get("id"))
        return False
    return grant_credits(db, user_id=user_id, provider="stripe", provider_ref=session["id"],
                         pack_id=metadata.get("pack_id", ""), credits=credits,
                         amount_cents=int(session.get("amount_total") or 0),
                         currency=str(session.get("currency") or ""))


@router.post("/webhook", include_in_schema=False)
async def webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    settings = get_settings()
    client = _stripe()
    payload = await request.body()
    try:
        event = client.construct_event(payload, request.headers.get("stripe-signature"),
                                       settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid signature") from None

    if event.type in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        await run_in_threadpool(fulfill_checkout, db, event.data.object.to_dict())
    return {"received": True}


class ConfirmIn(BaseModel):
    session_id: str


@router.post("/confirm")
def confirm(body: ConfirmIn, user: User = Depends(current_user),
            db: Session = Depends(get_db)) -> dict:
    """Called when the user returns from Checkout, so credits appear even if the webhook is late."""
    client = _stripe()
    try:
        session = client.v1.checkout.sessions.retrieve(body.session_id).to_dict()
    except stripe.StripeError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Checkout session not found.") from None
    if (session.get("metadata") or {}).get("user_id") != str(user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Checkout session not found.") from None
    fulfill_checkout(db, session)
    db.refresh(user)
    return {"paid": session.get("payment_status") == "paid", "credits": user.credits}


# ---------------------------------------------------------------- Razorpay (INR)
def _razorpay_on() -> None:
    if not get_settings().razorpay_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            "Rupee payments are not configured yet. Please try again later.")


def fulfill_razorpay(db: Session, order: dict, payment: dict) -> bool:
    """Grant credits for a captured payment on one of our orders. Idempotent per order id."""
    if payment.get("status") != "captured" or payment.get("order_id") != order.get("id"):
        return False
    if payment.get("amount") != order.get("amount") or str(payment.get("currency")).upper() != "INR":
        log.error("Razorpay payment %s does not match order %s", payment.get("id"), order.get("id"))
        return False
    notes = order.get("notes") or {}
    pack = next((p for p in get_settings().inr_credit_packs if p.id == notes.get("pack_id")), None)
    try:
        user_id = int(notes["user_id"])
        credits = pack.credits if pack else int(notes["credits"])
    except (KeyError, TypeError, ValueError):
        log.error("Razorpay order %s has no usable notes", order.get("id"))
        return False
    return grant_credits(db, user_id=user_id, provider="razorpay", provider_ref=order["id"],
                         pack_id=notes.get("pack_id", ""), credits=credits,
                         amount_cents=int(order.get("amount") or 0), currency="inr")


class RazorpayOrderIn(BaseModel):
    pack_id: str


@router.post("/razorpay/order")
def razorpay_order(body: RazorpayOrderIn, user: User = Depends(current_user)) -> dict:
    _razorpay_on()
    settings = get_settings()
    pack = next((p for p in settings.inr_credit_packs if p.id == body.pack_id), None)
    if pack is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown credit pack.")
    try:
        order = razorpay.create_order(pack, user.id)
    except razorpay.RazorpayError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from None
    return {
        "orderId": order["id"], "amount": order["amount"], "currency": "INR",
        "keyId": settings.razorpay_key_id, "name": settings.app_name,
        "description": f"{pack.name}: {pack.credits} credits",
        "prefill": {"name": user.name, "email": user.email},
    }


class RazorpayVerifyIn(BaseModel):
    order_id: str
    payment_id: str
    signature: str


@router.post("/razorpay/verify")
def razorpay_verify(body: RazorpayVerifyIn, user: User = Depends(current_user),
                    db: Session = Depends(get_db)) -> dict:
    """Called by the browser after Checkout succeeds, so credits appear without waiting for the webhook."""
    _razorpay_on()
    if not razorpay.checkout_signature_ok(body.order_id, body.payment_id, body.signature):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payment could not be verified.")
    try:
        order = razorpay.fetch_order(body.order_id)
        payment = razorpay.fetch_payment(body.payment_id)
    except razorpay.RazorpayError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from None
    if (order.get("notes") or {}).get("user_id") != str(user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found.")
    fulfill_razorpay(db, order, payment)
    db.refresh(user)
    status_ = payment.get("status")
    return {"paid": status_ == "captured", "pending": status_ == "authorized", "credits": user.credits}


@router.post("/razorpay/webhook", include_in_schema=False)
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    _razorpay_on()
    body = await request.body()
    if not razorpay.webhook_signature_ok(body, request.headers.get("x-razorpay-signature", "")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid signature")
    event = await request.json()
    if event.get("event") in ("payment.captured", "order.paid"):
        payload = event.get("payload") or {}
        payment = (payload.get("payment") or {}).get("entity") or {}
        order = (payload.get("order") or {}).get("entity")
        if payment.get("order_id"):
            if not order or not order.get("notes"):
                try:
                    order = await run_in_threadpool(razorpay.fetch_order, payment["order_id"])
                except razorpay.RazorpayError:
                    # A non-2xx response makes Razorpay retry the webhook later.
                    raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Retry later") from None
            await run_in_threadpool(fulfill_razorpay, db, order, payment)
    return {"received": True}


@router.get("/history")
def history(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    payments = db.scalars(select(Payment).where(Payment.user_id == user.id)
                          .order_by(Payment.created_at.desc()).limit(50)).all()
    usage = db.scalars(select(UsageEvent).where(UsageEvent.user_id == user.id)
                       .order_by(UsageEvent.created_at.desc()).limit(50)).all()
    return {
        "credits": user.credits,
        "payments": [{"id": p.id, "pack": p.pack_id, "credits": p.credits,
                      "amountCents": p.amount_cents, "currency": p.currency,
                      "createdAt": p.created_at.isoformat()} for p in payments],
        "usage": [{"action": u.action, "credits": u.credits,
                   "createdAt": u.created_at.isoformat()} for u in usage],
    }
