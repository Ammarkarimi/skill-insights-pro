import pytest

from app.config import get_settings
from app.db import SessionLocal
from app.models import Application, Payment, Story, User
from app.routers.billing import grant_credits
from app.services import mailer
from tests.conftest import register

PASSWORD = "correct-horse-1"


@pytest.fixture(autouse=True)
def _outbox():
    mailer.OUTBOX.clear()
    yield
    mailer.OUTBOX.clear()


def seed(user_id):
    with SessionLocal() as db:
        db.add(Application(user_id=user_id, company="Acme", title="Engineer", status="applied",
                           status_history=[], checklist={}))
        db.add(Story(user_id=user_id, title="Outage", situation="s", task="t", action="a", result="r",
                     themes=["ownership"], critique=None))
        db.commit()
        grant_credits(db, user_id=user_id, provider="stripe", provider_ref=f"cs_{user_id}", pack_id="pro",
                      credits=120, amount_cents=999, currency="usd")


def test_export_contains_everything_but_secrets(client, user):
    seed(user["id"])
    r = client.get("/api/account/export")
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    data = r.json()
    assert data["account"]["email"] == "ada@example.com"
    assert "password_hash" not in data["account"] and "email_canonical" not in data["account"]
    assert data["applications"][0]["company"] == "Acme" and data["stories"][0]["title"] == "Outage"
    assert data["payments"][0]["credits"] == 120
    assert "hash" not in r.text.replace("email_hash", "")


def test_delete_needs_password_and_confirmation(client, user):
    bad_confirm = {"password": PASSWORD, "confirm": "yes"}
    assert client.post("/api/account/delete", json=bad_confirm).status_code == 400
    wrong_password = {"password": "wrong-pass-1", "confirm": "DELETE"}
    assert client.post("/api/account/delete", json=wrong_password).status_code == 403
    assert client.get("/api/auth/me").status_code == 200


def test_delete_removes_the_user_and_keeps_detached_payments(client, user):
    seed(user["id"])
    client.post("/api/auth/logout")
    other = register(client, email="eve@example.com")
    seed(other["id"])
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"email": "ada@example.com", "password": PASSWORD})

    r = client.post("/api/account/delete", json={"password": PASSWORD, "confirm": "delete"})
    assert r.status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    assert mailer.OUTBOX[-1]["subject"].endswith("account was deleted")
    with SessionLocal() as db:
        assert db.get(User, user["id"]) is None
        assert db.query(Application).filter_by(user_id=user["id"]).count() == 0
        kept = db.query(Payment).filter_by(provider_ref=f"cs_{user['id']}").one()
        assert kept.user_id is None and kept.amount_cents == 999
        assert db.query(Application).filter_by(user_id=other["id"]).count() == 1  # others untouched
        assert db.query(Payment).filter_by(user_id=other["id"]).count() == 1


def test_signing_up_again_after_deleting_gets_no_second_bonus(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "require_email_verification", False)
    assert register(client)["credits"] == 10
    client.post("/api/account/delete", json={"password": PASSWORD, "confirm": "DELETE"})
    assert register(client)["credits"] == 0
