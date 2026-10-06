"""Signup protection: email verification before free credits, one bonus per inbox, throwaway
domains blocked, optional Cloudflare Turnstile, and first-touch attribution for ads.

Free credits cost real AI spend, so they are only granted once someone proves they own the inbox.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..data.disposable_domains import DISPOSABLE_DOMAINS
from ..models import SignupBonusClaim, User
from ..security import create_purpose_token
from . import mailer

log = logging.getLogger(__name__)

VERIFY = "verify"
VERIFY_HOURS = 48
TURNSTILE_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
ATTRIBUTION_KEYS = ("utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
                    "gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid", "referrer", "landing")


def canonical_email(email: str) -> str:
    """The inbox an address delivers to: "+tags" removed, and dots too for Gmail."""
    local, _, domain = email.strip().lower().partition("@")
    local = local.split("+", 1)[0]
    if domain in ("gmail.com", "googlemail.com"):
        local, domain = local.replace(".", ""), "gmail.com"
    return f"{local}@{domain}"


def is_disposable(email: str) -> bool:
    domain = email.rsplit("@", 1)[-1].strip().lower()
    extra = {d.strip().lower() for d in get_settings().blocked_email_domains.split(",") if d.strip()}
    # Subdomains of a blocked domain are blocked too (e.g. abc.mailinator.com).
    parts = domain.split(".")
    candidates = {".".join(parts[i:]) for i in range(len(parts) - 1)}
    return bool(candidates & (DISPOSABLE_DOMAINS | extra))


def clean_attribution(raw: dict | None) -> dict | None:
    if not raw:
        return None
    out = {k: str(raw[k])[:200] for k in ATTRIBUTION_KEYS if raw.get(k) not in (None, "")}
    return out or None


def turnstile_http_client() -> httpx.Client:
    return httpx.Client(timeout=10.0)


def turnstile_ok(token: str, ip: str) -> bool:
    """Server-side check of the Cloudflare Turnstile widget token. Fails closed."""
    if not token:
        return False
    try:
        with turnstile_http_client() as client:
            r = client.post(TURNSTILE_URL, data={"secret": get_settings().turnstile_secret_key,
                                                 "response": token, "remoteip": ip})
        return bool(r.json().get("success"))
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("Turnstile check failed: %s", exc)
        return False


def send_verification(user: User) -> bool:
    settings = get_settings()
    token = create_purpose_token(VERIFY, user.id, minutes=VERIFY_HOURS * 60, em=user.email)
    link = f"{settings.app_url.rstrip('/')}/verify-email?token={token}"
    bonus = settings.free_signup_credits
    paragraphs = ["Please confirm this is your email address."]
    if bonus and not user.signup_bonus:
        paragraphs.append(f"Your {bonus} free credits are added as soon as you confirm.")
    paragraphs.append(f"The link expires in {VERIFY_HOURS} hours.")
    return mailer.send(mailer.Email(
        to=user.email, subject=f"Confirm your email for {settings.app_name}",
        heading="Confirm your email", paragraphs=paragraphs,
        cta_label="Confirm my email", cta_url=link,
        footer="If you did not create an account, you can ignore this email."))


def bonus_hash(canonical: str) -> str:
    return hashlib.sha256(f"signup-bonus:{canonical}".encode()).hexdigest()


def _claim_bonus(db: Session, user: User) -> bool:
    """Record that this inbox got the bonus. False if it already had (unique hash)."""
    inbox = user.email_canonical or canonical_email(user.email)
    try:
        with db.begin_nested():
            db.add(SignupBonusClaim(email_hash=bonus_hash(inbox)))
    except IntegrityError:
        return False
    return True


def mark_verified(db: Session, user: User) -> int:
    """Verify the email and grant the signup bonus once per inbox, ever. Returns credits added."""
    added = 0
    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(timezone.utc)
    bonus = get_settings().free_signup_credits
    if not user.signup_bonus and bonus > 0 and _claim_bonus(db, user):
        user.signup_bonus = True
        # An UPDATE expression, so a charge running at the same moment is never overwritten.
        db.execute(update(User).where(User.id == user.id).values(credits=User.credits + bonus))
        added = bonus
    db.commit()
    db.refresh(user)
    return added
