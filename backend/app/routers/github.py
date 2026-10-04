from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import GithubAccount, User, utcnow
from ..security import current_user, optional_user
from ..services import github as svc

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/github", tags=["github"])


def account_for(db: Session, user_id: int) -> GithubAccount | None:
    return db.scalar(select(GithubAccount).where(GithubAccount.user_id == user_id))


@router.get("/status")
def github_status(user: User = Depends(current_user), db: Session = Depends(get_db)):
    acct = account_for(db, user.id)
    return {
        "enabled": get_settings().github_oauth_enabled,
        "connected": acct is not None,
        "login": acct.login if acct else None,
        "avatarUrl": acct.avatar_url if acct else None,
        "connectedAt": acct.connected_at.isoformat() if acct else None,
    }


@router.get("/connect")
def connect(user: User = Depends(current_user)):
    if not get_settings().github_oauth_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "GitHub sign-in is not configured.")
    return {"url": svc.authorize_url(svc.make_state(user.id))}


@router.get("/callback", include_in_schema=False)
def callback(code: str = Query(default=""), state: str = Query(default=""),
             user: User | None = Depends(optional_user), db: Session = Depends(get_db)):
    def back(result: str) -> RedirectResponse:
        return RedirectResponse(f"/portfolio?github={result}", status_code=status.HTTP_303_SEE_OTHER)

    if user is None:
        return RedirectResponse("/login", status_code=status.HTTP_303_SEE_OTHER)
    if not code or not svc.state_is_valid(state, user.id):
        return back("error")
    try:
        identity = svc.identity_from_code(code)
    except (svc.GithubError, KeyError, ValueError) as exc:
        log.warning("GitHub connect failed for user %s: %s", user.id, exc)
        return back("error")

    other = db.scalar(select(GithubAccount).where(GithubAccount.github_id == identity["id"]))
    if other is not None and other.user_id != user.id:
        return back("taken")  # one GitHub identity can back only one SkillSphere account
    acct = account_for(db, user.id) or GithubAccount(user_id=user.id)
    acct.github_id = identity["id"]
    acct.login = identity["login"]
    acct.name = identity["name"]
    acct.avatar_url = identity["avatar_url"]
    acct.connected_at = utcnow()
    db.add(acct)
    db.commit()
    return back("connected")


@router.delete("", status_code=204)
def disconnect(user: User = Depends(current_user), db: Session = Depends(get_db)):
    acct = account_for(db, user.id)
    if acct is not None:
        db.delete(acct)
        db.commit()
    return Response(status_code=204)
