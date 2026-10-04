"""GitHub integration: OAuth identity linking (and, in project reviews, public repo access).

All HTTP goes through `http_client()` so tests can swap in an httpx.MockTransport.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
import jwt

from ..config import get_settings

API = "https://api.github.com"
OAUTH_AUTHORIZE = "https://github.com/login/oauth/authorize"
OAUTH_TOKEN = "https://github.com/login/oauth/access_token"
_STATE_PURPOSE = "github-connect"


class GithubError(Exception):
    """A GitHub request failed in a way we can explain to the user."""


def http_client() -> httpx.Client:
    settings = get_settings()
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
               "User-Agent": "SkillSphere"}
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"
    return httpx.Client(headers=headers, timeout=15.0, follow_redirects=True)


# ---------------------------------------------------------------- OAuth
def callback_url() -> str:
    return f"{get_settings().app_url.rstrip('/')}/api/github/callback"


def make_state(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "purpose": _STATE_PURPOSE, "nonce": secrets.token_urlsafe(12),
               "iat": now, "exp": now + timedelta(minutes=10)}
    return jwt.encode(payload, get_settings().jwt_secret, algorithm="HS256")


def state_is_valid(state: str, user_id: int) -> bool:
    try:
        payload = jwt.decode(state, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return False
    return payload.get("purpose") == _STATE_PURPOSE and payload.get("sub") == str(user_id)


def authorize_url(state: str) -> str:
    params = {"client_id": get_settings().github_client_id, "redirect_uri": callback_url(),
              "scope": "read:user", "state": state, "allow_signup": "false"}
    return f"{OAUTH_AUTHORIZE}?{urlencode(params)}"


def identity_from_code(code: str) -> dict:
    """Exchange an OAuth code for the user's GitHub identity. The token is discarded."""
    settings = get_settings()
    with http_client() as client:
        resp = client.post(OAUTH_TOKEN, headers={"Accept": "application/json"}, data={
            "client_id": settings.github_client_id, "client_secret": settings.github_client_secret,
            "code": code, "redirect_uri": callback_url()})
        token = resp.json().get("access_token") if resp.status_code == 200 else None
        if not token:
            raise GithubError("GitHub did not accept the sign-in. Please try again.")
        user = client.get(f"{API}/user", headers={"Authorization": f"Bearer {token}"})
        if user.status_code != 200:
            raise GithubError("Could not read your GitHub profile.")
        data = user.json()
    return {"id": int(data["id"]), "login": data["login"], "name": data.get("name") or "",
            "avatar_url": data.get("avatar_url") or ""}
