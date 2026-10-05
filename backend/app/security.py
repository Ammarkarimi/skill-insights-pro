"""Password hashing, session tokens and the `current_user` dependency."""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import User

_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    # bcrypt only uses the first 72 bytes; truncate explicitly so long passwords never error.
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:72], password_hash.encode())
    except ValueError:
        return False


SESSION = "session"


def password_fingerprint(password_hash: str) -> str:
    """Changes whenever the password changes: binds sessions and reset links to the current password."""
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def create_session_token(user_id: int, password_hash: str = "") -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "purpose": SESSION, "iat": now,
               "exp": now + timedelta(days=settings.session_days)}
    if password_hash:
        payload["pf"] = password_fingerprint(password_hash)
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def create_purpose_token(purpose: str, user_id: int, minutes: int | None = None, **extra) -> str:
    """A signed single-purpose token (password reset, unsubscribe). Never valid as a session."""
    now = datetime.now(timezone.utc)
    payload = {"uid": user_id, "purpose": purpose, "iat": now, **extra}
    if minutes is not None:
        payload["exp"] = now + timedelta(minutes=minutes)
    return jwt.encode(payload, get_settings().jwt_secret, algorithm=_ALGORITHM)


def read_purpose_token(token: str, purpose: str) -> dict | None:
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=[_ALGORITHM])
    except jwt.PyJWTError:
        return None
    return payload if payload.get("purpose") == purpose and isinstance(payload.get("uid"), int) else None


def set_session_cookie(response: Response, user_id: int, password_hash: str = "") -> None:
    settings = get_settings()
    response.set_cookie(
        settings.cookie_name,
        create_session_token(user_id, password_hash),
        max_age=settings.session_days * 86400,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(settings.cookie_name, path="/")


def _session_from_request(request: Request) -> dict | None:
    settings = get_settings()
    token = request.cookies.get(settings.cookie_name)
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth[7:]
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[_ALGORITHM])
        payload["uid_int"] = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
    # Only session tokens sign a user in: never an OAuth state, reset or unsubscribe token.
    # (Sessions issued before purposes existed have none and stay valid until they expire.)
    if payload.get("purpose", SESSION) != SESSION:
        return None
    return payload


def _user_from_request(request: Request, db: Session) -> User | None:
    payload = _session_from_request(request)
    if payload is None:
        return None
    user = db.get(User, payload["uid_int"])
    # A password change (or reset) signs out sessions created with the old password.
    if user is not None and "pf" in payload and payload["pf"] != password_fingerprint(user.password_hash):
        return None
    return user


def optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    return _user_from_request(request, db)


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user = _user_from_request(request, db)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in to continue.")
    return user
