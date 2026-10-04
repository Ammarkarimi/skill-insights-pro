"""Credit packs, Stripe Checkout and the Stripe webhook."""

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


def fulfill_checkout(db: Session, session: dict) -> bool:
    """Grant credits for a paid Checkout Session. Idempotent; returns True if newly granted."""
    if session.get("payment_status") != "paid":
        return False
    metadata = session.get("metadata") or {}
    try:
        user_id = int(metadata["user_id"])
        credits = int(metadata["credits"])
    except (KeyError, TypeError, ValueError):
        log.error("Checkout session %s has no usable metadata", session.get("id"))
        return False
    if db.get(User, user_id) is None:
        log.error("Checkout session %s references unknown user %s", session.get("id"), user_id)
        return False
    try:
        db.add(Payment(
            user_id=user_id, provider="stripe", provider_ref=session["id"],
            pack_id=metadata.get("pack_id", ""), credits=credits,
            amount_cents=int(session.get("amount_total") or 0),
            currency=str(session.get("currency") or ""),
        ))
        db.execute(update(User).where(User.id == user_id).values(credits=User.credits + credits))
        db.commit()
    except IntegrityError:  # already fulfilled (webhook retry)
        db.rollback()
        return False
    log.info("Granted %s credits to user %s (session %s)", credits, user_id, session["id"])
    return True


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
