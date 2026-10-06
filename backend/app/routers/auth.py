from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import User
from ..ratelimit import limiter
from ..security import (
    clear_session_cookie,
    create_purpose_token,
    current_user,
    hash_password,
    password_fingerprint,
    read_purpose_token,
    set_session_cookie,
    verify_password,
)
from ..services import mailer, signup

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default="", max_length=120)
    turnstile_token: str = Field(default="", max_length=4096)
    # First-touch utm_* / click ids / referrer captured by the frontend (see services.signup).
    acquisition: dict[str, str | None] | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    credits: int
    emailVerified: bool


def to_out(user: User) -> UserOut:
    return UserOut(id=user.id, email=user.email, name=user.name, credits=user.credits,
                   emailVerified=user.email_verified_at is not None)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "?")


@router.post("/register", response_model=UserOut, status_code=201)
def register(body: RegisterIn, request: Request, response: Response,
             db: Session = Depends(get_db)) -> UserOut:
    settings = get_settings()
    ip = _client_ip(request)
    limiter.hit(f"auth:{ip}", settings.auth_attempts_per_minute)
    email = body.email.lower()
    if signup.is_disposable(email):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Please sign up with a permanent email address, not a temporary inbox.")
    if settings.turnstile_enabled and not signup.turnstile_ok(body.turnstile_token, ip):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Please complete the security check and try again.")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    limiter.hit(f"signup:{ip}", settings.signups_per_ip_per_day, 86400)
    user = User(email=email, name=body.name.strip(), password_hash=hash_password(body.password),
                credits=0, email_canonical=signup.canonical_email(email),
                acquisition=signup.clean_attribution(body.acquisition))
    db.add(user)
    db.commit()
    db.refresh(user)
    if settings.require_email_verification:
        signup.send_verification(user)
    else:
        signup.mark_verified(db, user)
    set_session_cookie(response, user.id, user.password_hash)
    return to_out(user)


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, request: Request, response: Response,
          db: Session = Depends(get_db)) -> UserOut:
    limiter.hit(f"auth:{_client_ip(request)}", get_settings().auth_attempts_per_minute)
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    set_session_cookie(response, user.id, user.password_hash)
    return to_out(user)


@router.post("/logout", status_code=204)
def logout(response: Response) -> Response:
    clear_session_cookie(response)
    response.status_code = 204
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> UserOut:
    return to_out(user)


# ---------------------------------------------------------------- email verification
class VerifyIn(BaseModel):
    token: str = Field(max_length=2000)


@router.post("/verify")
def verify_email(body: VerifyIn, request: Request, db: Session = Depends(get_db)) -> dict:
    """Works from any browser (the link may be opened on a phone), signed in or not."""
    limiter.hit(f"auth:{_client_ip(request)}", get_settings().auth_attempts_per_minute)
    payload = read_purpose_token(body.token, signup.VERIFY)
    user = db.get(User, payload["uid"]) if payload else None
    if user is None or payload.get("em") != user.email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "This link has expired or is not valid. Sign in to send a new one.")
    added = signup.mark_verified(db, user)
    claimed_elsewhere = added == 0 and not user.signup_bonus and get_settings().free_signup_credits > 0
    return {"verified": True, "creditsAdded": added, "alreadyClaimed": claimed_elsewhere}


@router.post("/verify/resend")
def resend_verification(user: User = Depends(current_user)) -> dict:
    if user.email_verified_at is not None:
        return {"sent": False, "verified": True}
    limiter.hit(f"verify:{user.id}", 3, 3600)
    sent = signup.send_verification(user)
    return {"sent": sent, "verified": False}


# ---------------------------------------------------------------- password reset
RESET = "reset"
RESET_MINUTES = 30


class ForgotIn(BaseModel):
    email: EmailStr


@router.post("/forgot")
async def forgot(body: ForgotIn, request: Request, db: Session = Depends(get_db)) -> dict:
    """Email a reset link. The response is the same whether or not the account exists."""
    settings = get_settings()
    if not settings.email_enabled and settings.is_production:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            "Password reset by email is not available yet. Please contact support.")
    limiter.hit(f"auth:{_client_ip(request)}", settings.auth_attempts_per_minute)
    limiter.hit(f"forgot:{body.email.lower()}", 3, 3600)
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user is not None:
        # Bound to the current password: the link stops working once it has been used.
        token = create_purpose_token(RESET, user.id, minutes=RESET_MINUTES,
                                     pf=password_fingerprint(user.password_hash))
        link = f"{settings.app_url.rstrip('/')}/reset-password?token={token}"
        await run_in_threadpool(mailer.send, mailer.Email(
            to=user.email, subject=f"Reset your {settings.app_name} password",
            heading="Reset your password",
            paragraphs=["Someone (hopefully you) asked to reset the password for this account.",
                        f"The link works once and expires in {RESET_MINUTES} minutes."],
            cta_label="Choose a new password", cta_url=link,
            footer="If you did not ask for this, you can ignore this email. Your password has not changed."))
    return {"sent": True}


class ResetIn(BaseModel):
    token: str = Field(max_length=2000)
    password: str = Field(min_length=8, max_length=128)


@router.post("/reset", response_model=UserOut)
def reset(body: ResetIn, request: Request, response: Response, db: Session = Depends(get_db)) -> UserOut:
    limiter.hit(f"auth:{_client_ip(request)}", get_settings().auth_attempts_per_minute)
    payload = read_purpose_token(body.token, RESET)
    user = db.get(User, payload["uid"]) if payload else None
    if user is None or payload.get("pf") != password_fingerprint(user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "This reset link has expired or was already used. Please request a new one.")
    user.password_hash = hash_password(body.password)
    db.commit()
    # Signs this browser in; sessions created with the old password stop working.
    set_session_cookie(response, user.id, user.password_hash)
    return to_out(user)
