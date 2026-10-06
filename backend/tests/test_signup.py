import re

import httpx
import pytest

from app.config import get_settings
from app.db import SessionLocal
from app.models import User
from app.security import create_purpose_token
from app.services import mailer, signup


@pytest.fixture(autouse=True)
def _verification_on(monkeypatch):
    monkeypatch.setattr(get_settings(), "require_email_verification", True)
    mailer.OUTBOX.clear()
    yield
    mailer.OUTBOX.clear()


def sign_up(client, email="ada@example.com", **extra):
    return client.post("/api/auth/register",
                       json={"email": email, "password": "correct-horse-1", "name": "Ada", **extra})


def verify_token():
    return re.search(r"/verify-email\?token=(\S+)", mailer.OUTBOX[-1]["text"]).group(1)


def test_free_credits_only_after_verifying(client):
    r = sign_up(client)
    assert r.status_code == 201
    assert r.json()["credits"] == 0 and r.json()["emailVerified"] is False
    assert "10 free credits" in mailer.OUTBOX[-1]["text"]
    token = verify_token()
    client.cookies.clear()  # the link works in any browser, signed in or not
    assert client.post("/api/auth/verify", json={"token": token}).json() == {
        "verified": True, "creditsAdded": 10, "alreadyClaimed": False}
    assert client.post("/api/auth/verify", json={"token": token}).json()["creditsAdded"] == 0  # once
    client.post("/api/auth/login", json={"email": "ada@example.com", "password": "correct-horse-1"})
    me = client.get("/api/auth/me").json()
    assert me["credits"] == 10 and me["emailVerified"] is True


@pytest.mark.parametrize("alias", ["ada+2@example.com", "ADA+jobs@Example.com"])
def test_one_bonus_per_inbox(client, alias):
    sign_up(client)
    client.post("/api/auth/verify", json={"token": verify_token()})
    client.post("/api/auth/logout")
    sign_up(client, alias)
    body = client.post("/api/auth/verify", json={"token": verify_token()}).json()
    assert body == {"verified": True, "creditsAdded": 0, "alreadyClaimed": True}
    assert client.get("/api/auth/me").json()["credits"] == 0


def test_gmail_dots_are_the_same_inbox():
    assert signup.canonical_email("A.d.a+cv@googlemail.com") == "ada@gmail.com"
    assert signup.canonical_email("a.da@outlook.com") == "a.da@outlook.com"


def test_bad_or_foreign_tokens(client):
    uid = sign_up(client).json()["id"]
    reset = create_purpose_token("reset", uid, minutes=30)
    stale = create_purpose_token(signup.VERIFY, uid, minutes=-1, em="ada@example.com")
    other_email = create_purpose_token(signup.VERIFY, uid, minutes=30, em="eve@example.com")
    for token in (reset, stale, other_email, "nope"):
        assert client.post("/api/auth/verify", json={"token": token}).status_code == 400


def test_throwaway_domains_are_blocked(client, monkeypatch):
    for email in ("x@mailinator.com", "x@inbox.mailinator.com", "x@YOPMAIL.com"):
        r = sign_up(client, email)
        assert r.status_code == 400 and "permanent email" in r.json()["detail"]
    monkeypatch.setattr(get_settings(), "blocked_email_domains", "spam.example.net, Junk.example.org")
    assert sign_up(client, "x@junk.example.org").status_code == 400
    assert sign_up(client, "x@example.org").status_code == 201  # only listed domains


def test_signups_per_ip_are_capped(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "signups_per_ip_per_day", 2)
    assert sign_up(client, "a@example.com").status_code == 201
    assert sign_up(client, "b@example.com").status_code == 201
    assert sign_up(client, "a@example.com").status_code == 409  # duplicates do not use up the cap
    assert sign_up(client, "c@example.com").status_code == 429


def test_turnstile_is_checked_server_side(client, monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "turnstile_site_key", "site")
    monkeypatch.setattr(s, "turnstile_secret_key", "secret")
    seen = []

    def handler(request):
        seen.append(request.content.decode())
        return httpx.Response(200, json={"success": b"good-token" in request.content})

    monkeypatch.setattr(signup, "turnstile_http_client",
                        lambda: httpx.Client(transport=httpx.MockTransport(handler)))
    assert sign_up(client).status_code == 400  # no token
    assert sign_up(client, turnstile_token="forged").status_code == 400
    assert sign_up(client, turnstile_token="good-token").status_code == 201
    assert "secret=secret" in seen[-1]


def test_resend_is_rate_limited_and_stops_once_verified(client):
    sign_up(client)
    for _ in range(3):
        assert client.post("/api/auth/verify/resend").json() == {"sent": True, "verified": False}
    assert client.post("/api/auth/verify/resend").status_code == 429
    client.post("/api/auth/verify", json={"token": verify_token()})
    assert client.post("/api/auth/verify/resend").json() == {"sent": False, "verified": True}


def test_attribution_is_stored_and_cleaned(client):
    sign_up(client, acquisition={"utm_source": "google", "utm_campaign": "uk-interview",
                                 "gclid": "x" * 500, "evil": "<script>", "utm_term": ""})
    with SessionLocal() as db:
        user = db.query(User).one()
    assert user.acquisition == {"utm_source": "google", "utm_campaign": "uk-interview", "gclid": "x" * 200}


def test_production_needs_email_for_verification(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "jwt_secret", "p" * 40)
    monkeypatch.setattr(s, "app_url", "https://app.example.com")
    monkeypatch.setattr(s, "support_email", "help@skillsphere.app")
    with pytest.raises(RuntimeError, match="SMTP_HOST"):
        s.validate_for_production()
    monkeypatch.setattr(s, "require_email_verification", False)
    s.validate_for_production()


def test_public_config_has_no_secrets(client, monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "turnstile_site_key", "site-key")
    assert client.get("/api/config").json()["turnstileSiteKey"] == ""  # secret missing: widget off
    monkeypatch.setattr(s, "turnstile_secret_key", "very-secret")
    body = client.get("/api/config").json()
    assert body["turnstileSiteKey"] == "site-key" and "very-secret" not in str(body)
