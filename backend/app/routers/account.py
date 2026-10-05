from __future__ import annotations

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import EmailPreference, User, utcnow
from ..ratelimit import limiter
from ..security import create_purpose_token, current_user, read_purpose_token
from ..services import mailer

router = APIRouter(tags=["account"])

UNSUBSCRIBE = "unsubscribe"


def unsubscribe_links(user_id: int) -> dict:
    """Footer link (a page) and one-click URL (for mail clients) for reminder emails."""
    token = create_purpose_token(UNSUBSCRIBE, user_id)
    base = get_settings().app_url.rstrip("/")
    return {"unsubscribe_url": f"{base}/unsubscribe?token={token}",
            "one_click_url": f"{base}/api/email/unsubscribe?token={token}"}


def prefs_for(db: Session, user_id: int) -> EmailPreference | None:
    return db.scalar(select(EmailPreference).where(EmailPreference.user_id == user_id))


def view(p: EmailPreference | None) -> dict:
    return {
        "emailEnabled": get_settings().email_enabled,
        "decided": p is not None,
        "daily": bool(p and p.daily),
        "weekly": bool(p and p.weekly),
        "timezone": p.timezone if p else "UTC",
        "sendHour": p.send_hour if p else 8,
    }


class PrefsIn(BaseModel):
    daily: bool
    weekly: bool
    timezone: str = Field(default="UTC", max_length=64)
    send_hour: int = Field(default=8, ge=0, le=23)

    @field_validator("timezone")
    @classmethod
    def _valid_zone(cls, v: str) -> str:
        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("unknown time zone") from None
        return v


@router.get("/api/account/email-preferences")
def get_prefs(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return view(prefs_for(db, user.id))


@router.put("/api/account/email-preferences")
def put_prefs(body: PrefsIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = prefs_for(db, user.id)
    if p is None:
        p = EmailPreference(user_id=user.id)
        db.add(p)
    p.daily, p.weekly, p.timezone, p.send_hour = body.daily, body.weekly, body.timezone, body.send_hour
    p.updated_at = utcnow()
    db.commit()
    return view(p)


@router.post("/api/account/test-email")
async def test_email(user: User = Depends(current_user)):
    if not get_settings().email_enabled and get_settings().is_production:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Email is not set up on this site yet.")
    limiter.hit(f"test-email:{user.id}", 3, 3600)
    mail = mailer.Email(
        to=user.email, subject=f"Test email from {get_settings().app_name}",
        heading="Your reminders will arrive here",
        paragraphs=["This is a test. If you can read it, reminder emails will reach you.",
                    "Tip: if it landed in spam, mark it as 'not spam' so future reminders arrive in "
                    "your inbox."],
        cta_label="Open your dashboard", cta_url=f"{get_settings().app_url.rstrip('/')}/home",
        **unsubscribe_links(user.id))
    if not await run_in_threadpool(mailer.send, mail):
        raise HTTPException(status.HTTP_502_BAD_GATEWAY,
                            "The email could not be sent. Please try again later.")
    return {"sent": True}


class UnsubscribeIn(BaseModel):
    token: str = Field(max_length=2000)


@router.post("/api/email/unsubscribe")
async def unsubscribe(request: Request, token: str | None = None, db: Session = Depends(get_db)):
    """Accepts the token as JSON (from the unsubscribe page) or in the query (mail-client one-click POST)."""
    if token is None:
        try:
            token = UnsubscribeIn.model_validate(await request.json()).token
        except ValueError:
            token = ""
    payload = read_purpose_token(token, UNSUBSCRIBE)
    if payload is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This unsubscribe link is not valid.")
    p = prefs_for(db, payload["uid"])
    if p is None:
        p = EmailPreference(user_id=payload["uid"])
        db.add(p)
    p.daily = p.weekly = False
    p.updated_at = utcnow()
    db.commit()
    return {"unsubscribed": True}
