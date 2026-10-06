from __future__ import annotations

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import EmailPreference, User, utcnow
from ..ratelimit import limiter
from ..security import clear_session_cookie, current_user, read_purpose_token, verify_password
from ..services import account_data, mailer
from ..services.mailer import UNSUBSCRIBE, unsubscribe_links

router = APIRouter(tags=["account"])

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


# ---------------------------------------------------------------- your data
@router.get("/api/account/export")
def export(user: User = Depends(current_user), db: Session = Depends(get_db)) -> JSONResponse:
    """Everything stored about the user, as a JSON download."""
    limiter.hit(f"export:{user.id}", 5, 3600)
    filename = f"{get_settings().app_name.lower()}-data-{utcnow().date().isoformat()}.json"
    return JSONResponse(account_data.export_data(db, user),
                        headers={"Content-Disposition": f'attachment; filename="{filename}"',
                                 "Cache-Control": "no-store"})


class DeleteIn(BaseModel):
    password: str = Field(max_length=128)
    confirm: str = Field(max_length=20)


@router.post("/api/account/delete", status_code=204)
async def delete_account(body: DeleteIn, response: Response, user: User = Depends(current_user),
                         db: Session = Depends(get_db)) -> Response:
    limiter.hit(f"delete:{user.id}", 5, 3600)
    if body.confirm.strip().upper() != "DELETE":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Type DELETE to confirm.")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "That password is not correct.")
    email, name = user.email, get_settings().app_name
    await run_in_threadpool(account_data.delete_account, db, user)
    await run_in_threadpool(mailer.send, mailer.Email(
        to=email, subject=f"Your {name} account was deleted", heading="Your account was deleted",
        paragraphs=["Your account and the data in it have been deleted, as you asked.",
                    "Records of past payments are kept, without your details, because tax law requires it.",
                    "If you did not do this, contact us straight away."]))
    clear_session_cookie(response)
    response.status_code = 204
    return response
