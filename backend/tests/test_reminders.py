from datetime import datetime, timedelta, timezone

import pytest

from app import jobs
from app.config import get_settings
from app.db import SessionLocal
from app.models import Application, EmailLog, PracticeLog, ReviewCard
from app.services import mailer, reminders

# 02:30 UTC is 08:00 in India (UTC+5:30). 2026-03-10 is a Tuesday, 2026-03-09 a Monday.
TUESDAY_8AM_IST = datetime(2026, 3, 10, 2, 30, tzinfo=timezone.utc)
MONDAY_8AM_IST = datetime(2026, 3, 9, 2, 30, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def _outbox():
    mailer.OUTBOX.clear()
    yield
    mailer.OUTBOX.clear()


def opt_in(client, daily=True, weekly=False, tz="Asia/Kolkata", hour=8):
    r = client.put("/api/account/email-preferences",
                   json={"daily": daily, "weekly": weekly, "timezone": tz, "send_hour": hour})
    assert r.status_code == 200


def run(now):
    with SessionLocal() as db:
        return reminders.run(db, now)


def add(user_id, *rows):
    with SessionLocal() as db:
        for row in rows:
            row.user_id = user_id
            db.add(row)
        db.commit()


def card(i):
    return ReviewCard(qhash=f"h{i}", source="assessment", skill="Python", box=1, reviews=0,
                      question={"question": f"Q{i}", "options": {"A": "a"}, "answer": "A"},
                      due_at=TUESDAY_8AM_IST - timedelta(days=1))


def test_no_email_without_opt_in_or_without_anything_to_do(client, user):
    add(user["id"], card(1))
    assert run(TUESDAY_8AM_IST)["checked"] == 0  # never opted in
    opt_in(client)
    with SessionLocal() as db:
        db.query(ReviewCard).delete()
        db.commit()
    assert run(TUESDAY_8AM_IST) == {"checked": 1, "sent": 0, "nothingToSend": 1}
    assert mailer.OUTBOX == []


def test_daily_nudge_only_at_local_send_hour_and_only_once(client, user):
    opt_in(client)
    add(user["id"], card(1), card(2))
    assert run(TUESDAY_8AM_IST - timedelta(hours=1))["checked"] == 0  # 07:00 local
    assert run(TUESDAY_8AM_IST)["sent"] == 1
    mail = mailer.OUTBOX[-1]
    assert mail["subject"] == "2 mistakes to review today" and "/learning" in mail["text"]
    assert "Unsubscribe: http" in mail["text"]
    assert run(TUESDAY_8AM_IST + timedelta(minutes=20))["sent"] == 0  # a repeated run in the same hour
    assert len(mailer.OUTBOX) == 1


def test_interview_today_leads_the_email(client, user):
    opt_in(client)
    add(user["id"],
        Application(company="Acme", title="Backend Engineer", status="interview", status_history=[],
                    next_date="2026-03-10", next_label="Onsite interview", checklist={}),
        Application(company="Globex", title="SRE", status="applied", status_history=[],
                    next_date="2026-03-11", next_label="Recruiter call", checklist={}),
        Application(company="Initech", title="Dev", status="rejected", status_history=[],
                    next_date="2026-03-10", next_label="Closed", checklist={}))
    run(TUESDAY_8AM_IST)
    mail = mailer.OUTBOX[-1]
    assert mail["subject"] == "Today: Onsite interview at Acme"
    assert "Tomorrow: Recruiter call for SRE at Globex." in mail["text"]
    assert "Initech" not in mail["text"]  # closed applications are ignored
    assert "/applications?open=" in mail["text"]


def test_streak_at_risk(client, user):
    opt_in(client)
    add(user["id"], PracticeLog(day="2026-03-09", kind="review", count=3),
        PracticeLog(day="2026-03-08", kind="coding", count=1))
    run(TUESDAY_8AM_IST)
    assert mailer.OUTBOX[-1]["subject"] == "Keep your 2-day streak going"


def test_weekly_summary_on_monday_only(client, user):
    opt_in(client, daily=False, weekly=True)
    add(user["id"], PracticeLog(day="2026-03-03", kind="review", count=4),
        PracticeLog(day="2026-03-05", kind="aptitude", count=1),
        PracticeLog(day="2026-03-09", kind="coding", count=2))  # this week: not counted
    assert run(TUESDAY_8AM_IST)["sent"] == 0
    assert run(MONDAY_8AM_IST)["sent"] == 1
    mail = mailer.OUTBOX[-1]
    assert mail["subject"] == "Your week: 2 practice days"
    assert "Practised on 2 of 7 days" in mail["text"] and "4 review cards, 1 aptitude test." in mail["text"]
    assert run(MONDAY_8AM_IST)["sent"] == 0  # once per week
    with SessionLocal() as db:
        assert db.query(EmailLog).filter(EmailLog.ref == "2026-W11").count() == 1


def test_failed_send_releases_the_claim(client, user, monkeypatch):
    opt_in(client)
    add(user["id"], card(1))
    monkeypatch.setattr(mailer, "send", lambda mail: False)
    assert run(TUESDAY_8AM_IST)["sent"] == 0
    with SessionLocal() as db:
        assert db.query(EmailLog).count() == 0


def test_cron_endpoint_needs_the_secret(client, user, monkeypatch):
    assert client.post("/api/internal/cron/reminders").status_code == 503  # no CRON_SECRET yet
    monkeypatch.setattr(get_settings(), "cron_secret", "s3cret-value")
    bad = client.post("/api/internal/cron/reminders", headers={"Authorization": "Bearer nope"})
    assert bad.status_code == 401
    r = client.post("/api/internal/cron/reminders", headers={"Authorization": "Bearer s3cret-value"})
    assert r.status_code == 200 and set(r.json()) == {"checked", "sent", "nothingToSend"}


def test_cli_job(capsys):
    assert jobs.main(["app.jobs"]) == 2
    assert jobs.main(["app.jobs", "reminders"]) == 0
    assert '"sent": 0' in capsys.readouterr().out
