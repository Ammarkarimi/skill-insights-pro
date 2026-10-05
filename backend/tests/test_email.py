import re
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.config import get_settings
from app.services import github, mailer
from app.services.mailer import Email, build_message
from tests.conftest import register


@pytest.fixture(autouse=True)
def _outbox():
    mailer.OUTBOX.clear()
    yield
    mailer.OUTBOX.clear()


def link_from_outbox(kind="reset-password"):
    text = mailer.OUTBOX[-1]["text"]
    return re.search(rf"https?://\S+/{kind}\?token=(\S+)", text).group(1)


# ---------------------------------------------------------------- session hardening
def test_only_session_tokens_sign_in(client, user):
    state = github.make_state(user["id"])  # an OAuth state token is signed with the same secret
    client.cookies.clear()
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {state}"}).status_code == 401
    legacy = jwt.encode({"sub": str(user["id"]), "exp": datetime.now(timezone.utc) + timedelta(days=1)},
                        get_settings().jwt_secret, algorithm="HS256")
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {legacy}"}).status_code == 200


def test_reset_tokens_cannot_sign_in(client, user):
    client.post("/api/auth/forgot", json={"email": "ada@example.com"})
    token = link_from_outbox()
    client.cookies.clear()
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


# ---------------------------------------------------------------- password reset
def test_forgot_does_not_reveal_accounts(client):
    r = client.post("/api/auth/forgot", json={"email": "nobody@example.com"})
    assert r.status_code == 200 and r.json() == {"sent": True}
    assert mailer.OUTBOX == []


def test_reset_flow_is_single_use_and_signs_out_old_sessions(client, user):
    old_cookie = client.cookies.get(get_settings().cookie_name)
    client.post("/api/auth/forgot", json={"email": "ADA@example.com"})
    mail = mailer.OUTBOX[-1]
    assert mail["to"] == "ada@example.com" and "expires in 30 minutes" in mail["text"]
    token = link_from_outbox()
    client.cookies.clear()
    r = client.post("/api/auth/reset", json={"token": token, "password": "brand-new-pass-9"})
    assert r.status_code == 200 and r.json()["email"] == "ada@example.com"
    assert client.get("/api/auth/me").status_code == 200  # signed in by the reset
    again = client.post("/api/auth/reset", json={"token": token, "password": "another-pass-10"})
    assert again.status_code == 400  # the link only works once
    client.cookies.clear()
    stale = client.get("/api/auth/me", headers={"Authorization": f"Bearer {old_cookie}"})
    assert stale.status_code == 401  # sessions from before the reset are signed out
    assert client.post("/api/auth/login", json={"email": "ada@example.com",
                                                "password": "brand-new-pass-9"}).status_code == 200


def test_expired_or_forged_reset_tokens(client, user):
    from app.db import SessionLocal
    from app.models import User
    from app.security import create_purpose_token, password_fingerprint
    with SessionLocal() as db:
        pf = password_fingerprint(db.get(User, user["id"]).password_hash)
    expired = create_purpose_token("reset", user["id"], minutes=-1, pf=pf)
    wrong_purpose = create_purpose_token("unsubscribe", user["id"], pf=pf)
    for token in (expired, wrong_purpose, "not-a-token"):
        r = client.post("/api/auth/reset", json={"token": token, "password": "brand-new-pass-9"})
        assert r.status_code == 400
    assert client.post("/api/auth/reset", json={"token": expired, "password": "short"}).status_code == 422


def test_forgot_is_rate_limited_per_email(client, user):
    for _ in range(3):
        assert client.post("/api/auth/forgot", json={"email": "ada@example.com"}).status_code == 200
    assert client.post("/api/auth/forgot", json={"email": "ada@example.com"}).status_code == 429
    assert len(mailer.OUTBOX) == 3


# ---------------------------------------------------------------- preferences and unsubscribe
def test_preferences_default_to_undecided_and_validate(client, user):
    p = client.get("/api/account/email-preferences").json()
    assert p["decided"] is False and p["daily"] is False and p["emailEnabled"] is False
    r = client.put("/api/account/email-preferences",
                   json={"daily": True, "weekly": True, "timezone": "Asia/Kolkata", "send_hour": 7})
    assert r.json() == {"emailEnabled": False, "decided": True, "daily": True, "weekly": True,
                        "timezone": "Asia/Kolkata", "sendHour": 7}
    bad_zone = {"daily": True, "weekly": False, "timezone": "Mars/Base", "send_hour": 7}
    assert client.put("/api/account/email-preferences", json=bad_zone).status_code == 422
    bad_hour = {"daily": True, "weekly": False, "timezone": "UTC", "send_hour": 24}
    assert client.put("/api/account/email-preferences", json=bad_hour).status_code == 422


def test_test_email_has_unsubscribe_links_and_is_rate_limited(client, user):
    assert client.post("/api/account/test-email").json() == {"sent": True}
    text = mailer.OUTBOX[-1]["text"]
    assert "Unsubscribe: http" in text and "/unsubscribe?token=" in text
    client.post("/api/account/test-email")
    client.post("/api/account/test-email")
    assert client.post("/api/account/test-email").status_code == 429


def test_unsubscribe_by_page_and_one_click(client, user):
    on = {"daily": True, "weekly": True, "timezone": "UTC", "send_hour": 8}
    client.put("/api/account/email-preferences", json=on)
    client.post("/api/account/test-email")
    token = link_from_outbox("unsubscribe")
    client.cookies.clear()  # works without being signed in
    assert client.post("/api/email/unsubscribe", json={"token": token}).json() == {"unsubscribed": True}
    assert client.post("/api/email/unsubscribe", json={"token": "nope"}).status_code == 400
    client.post("/api/auth/login", json={"email": "ada@example.com", "password": "correct-horse-1"})
    assert client.get("/api/account/email-preferences").json()["daily"] is False
    client.put("/api/account/email-preferences", json=on)
    assert client.post(f"/api/email/unsubscribe?token={token}").status_code == 200  # mail-client POST
    assert client.get("/api/account/email-preferences").json()["weekly"] is False


def test_unsubscribe_token_cannot_change_another_user(client, user):
    client.post("/api/account/test-email")
    token = link_from_outbox("unsubscribe")
    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    on = {"daily": True, "weekly": True, "timezone": "UTC", "send_hour": 8}
    client.put("/api/account/email-preferences", json=on)
    client.post("/api/email/unsubscribe", json={"token": token})  # Ada's token
    assert client.get("/api/account/email-preferences").json()["daily"] is True  # Eve unaffected


def test_message_headers_and_escaping(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "smtp_from", "SkillSphere <hello@example.com>")
    mail = Email(to="ada@example.com", subject="Hi", heading="<b>Hello</b>", paragraphs=["5 < 6 & ok"],
                 cta_label="Go", cta_url="https://example.com/?a=1&b=2",
                 unsubscribe_url="https://example.com/unsubscribe?token=t",
                 one_click_url="https://example.com/api/email/unsubscribe?token=t")
    msg = build_message(mail)
    assert msg["List-Unsubscribe"] == "<https://example.com/api/email/unsubscribe?token=t>"
    assert msg["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    assert msg["From"] == "SkillSphere <hello@example.com>"
    html = msg.get_body(("html",)).get_content()
    assert "&lt;b&gt;Hello&lt;/b&gt;" in html and "5 &lt; 6 &amp; ok" in html and "a=1&amp;b=2" in html
    assert "Unsubscribe: https://example.com/unsubscribe?token=t" in msg.get_body(("plain",)).get_content()


def test_production_without_smtp_drops_mail(monkeypatch):
    monkeypatch.setattr(get_settings(), "environment", "production")
    assert mailer.send(Email(to="a@example.com", subject="x", heading="x")) is False
    assert mailer.OUTBOX == []
