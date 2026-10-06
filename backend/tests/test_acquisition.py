from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app import jobs
from app.config import Settings, get_settings
from app.db import SessionLocal
from app.models import User
from app.routers.billing import grant_credits
from app.services import acquisition

NOW = datetime.now(timezone.utc)


def add_user(email, acq, verified=True, days_ago=1):
    with SessionLocal() as db:
        user = User(email=email, name="", password_hash="x", credits=0, email_canonical=email,
                    acquisition=acq, created_at=NOW - timedelta(days=days_ago),
                    email_verified_at=NOW if verified else None)
        db.add(user)
        db.commit()
        return user.id


def test_report_groups_by_campaign_with_conversion():
    a = add_user("a@example.com", {"utm_source": "google", "utm_campaign": "uk-interview", "gclid": "x"})
    add_user("b@example.com", {"utm_source": "google", "utm_campaign": "uk-interview"}, verified=False)
    add_user("c@example.com", {"fbclid": "y"})
    add_user("d@example.com", {"referrer": "https://www.reddit.com/r/cscareerquestions"})
    add_user("e@example.com", None)
    add_user("old@example.com", {"utm_source": "google"}, days_ago=90)  # outside the window
    with SessionLocal() as db:
        grant_credits(db, user_id=a, provider="paddle", provider_ref="txn_1", pack_id="pro", credits=120,
                      amount_cents=799, currency="gbp")
        rows = acquisition.report(db, NOW, days=30)
    assert rows[0] == {"source": "google / uk-interview", "signups": 2, "verified": 1, "buyers": 1,
                       "revenue": {"gbp": 7.99}}
    assert {r["source"] for r in rows[1:]} == {"meta (no utm)", "referral: reddit.com", "direct / unknown"}


def test_cli(capsys):
    assert jobs.main(["app.jobs", "acquisition", "7"]) == 0
    assert capsys.readouterr().out.strip() == "[]"
    assert jobs.main(["app.jobs", "acquisition", "x"]) == 2


def test_tracking_ids_are_validated_and_published(client, monkeypatch):
    with pytest.raises(ValidationError):
        Settings(ga_measurement_id="G-1'><script>")
    monkeypatch.setattr(get_settings(), "ga_measurement_id", "G-ABC123")
    monkeypatch.setattr(get_settings(), "meta_pixel_id", "1234567890")
    analytics = client.get("/api/config").json()["analytics"]
    assert analytics["ga4"] == "G-ABC123" and analytics["metaPixel"] == "1234567890"
    assert analytics["googleAds"] == ""
