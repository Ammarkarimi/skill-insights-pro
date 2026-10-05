"""Opt-in reminder emails: at most one daily nudge (only when there is something to act on) and a
Monday summary, each sent at the user's chosen local hour.

`run()` is called hourly by a cron job. A unique EmailLog row per (user, kind, day or week) makes
repeated runs harmless.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Application, EmailLog, EmailPreference, Evidence, PracticeLog, User
from . import learning, mailer, readiness
from .applications import CLOSED

log = logging.getLogger(__name__)

PRACTICE_NAMES = {"review": "review card", "assessment": "skill assessment", "aptitude": "aptitude test",
                  "coding": "coding run", "proof": "skill proof", "drill": "behavioral drill",
                  "plan": "learning-plan step"}


def _count(n: int, kind: str) -> str:
    name = PRACTICE_NAMES.get(kind, kind)
    return f"{n} {name}{'' if n == 1 else 's'}"


def local_time(prefs: EmailPreference, now: datetime) -> datetime:
    try:
        return now.astimezone(ZoneInfo(prefs.timezone))
    except (ZoneInfoNotFoundError, ValueError):
        return now.astimezone(ZoneInfo("UTC"))


def _url(path: str) -> str:
    return f"{get_settings().app_url.rstrip('/')}{path}"


def _apps_on(db: Session, user_id: int, day: date) -> list[Application]:
    return list(db.scalars(select(Application).where(
        Application.user_id == user_id, Application.next_date == day.isoformat(),
        Application.status.notin_(CLOSED))))


# ---------------------------------------------------------------- daily nudge
def daily_email(db: Session, user: User, local: datetime, now: datetime) -> mailer.Email | None:
    """The day's nudge, or None when there is nothing worth an email."""
    s = learning.summary(db, user.id, now)
    today, tomorrow = local.date(), local.date() + timedelta(days=1)
    apps_today, apps_tomorrow = _apps_on(db, user.id, today), _apps_on(db, user.id, tomorrow)
    bullets: list[str] = []
    for a in apps_today:
        bullets.append(f"Today: {a.next_label or 'next step'} for {a.title} at {a.company}.")
    for a in apps_tomorrow:
        bullets.append(f"Tomorrow: {a.next_label or 'next step'} for {a.title} at {a.company}.")
    if s["dueCards"]:
        n = s["dueCards"]
        bullets.append(f"{n} past mistake{'s' if n != 1 else ''} to review (about two minutes).")
    at_risk = s["streak"] >= 2 and not s["practicedToday"]
    if at_risk:
        bullets.append(f"Practise anything today to keep your {s['streak']}-day streak.")
    if not bullets:
        return None  # nothing to act on: no email
    plan = next(iter(s["activePlans"]), None)
    if plan and plan["nextWeek"]:
        bullets.append(f"Your plan '{plan['title']}' is on week {plan['nextWeek']}.")

    if apps_today:
        a = apps_today[0]
        subject = f"Today: {a.next_label or 'next step'} at {a.company}"
        cta = ("Open your prep checklist", _url(f"/applications?open={a.id}"))
    elif apps_tomorrow:
        a = apps_tomorrow[0]
        subject = f"Tomorrow: {a.next_label or 'next step'} at {a.company}"
        cta = ("Get ready", _url(f"/applications?open={a.id}"))
    elif s["dueCards"]:
        subject = f"{s['dueCards']} mistake{'s' if s['dueCards'] != 1 else ''} to review today"
        cta = ("Start the 2-minute review", _url("/learning"))
    else:
        subject = f"Keep your {s['streak']}-day streak going"
        cta = ("Practise now", _url("/learning"))
    name = (user.name or "").split(" ")[0]
    return mailer.Email(
        to=user.email, subject=subject, heading=f"Good morning{', ' + name if name else ''}",
        paragraphs=["Here is what is waiting for you today:"], bullets=bullets,
        cta_label=cta[0], cta_url=cta[1],
        footer="You get this because you turned on daily reminders. Change them in Settings.",
        **mailer.unsubscribe_links(user.id))


# ---------------------------------------------------------------- weekly summary
def weekly_email(db: Session, user: User, local: datetime, now: datetime) -> mailer.Email:
    """Monday summary of the previous seven days."""
    end = local.date()
    start = end - timedelta(days=7)
    logs = db.scalars(select(PracticeLog).where(PracticeLog.user_id == user.id,
                                                PracticeLog.day >= start.isoformat(),
                                                PracticeLog.day < end.isoformat()))
    days, kinds = set(), {}
    for row in logs:
        days.add(row.day)
        kinds[row.kind] = kinds.get(row.kind, 0) + row.count
    s = learning.summary(db, user.id, now)
    bullets = [f"Practised on {len(days)} of 7 days (goal: {learning.WEEKLY_GOAL_DAYS})."]
    done = [_count(n, k) for k, n in sorted(kinds.items(), key=lambda kv: -kv[1])]
    if done:
        bullets.append("Done: " + ", ".join(done) + ".")

    target = readiness.active_target(db, user.id)
    if target is not None:
        evidence = list(db.scalars(select(Evidence).where(Evidence.user_id == user.id,
                                                          Evidence.target_role_id == target.id)))
        score_now = readiness.compute_readiness(target, evidence, now)["score"]
        score_then = readiness.compute_readiness(target, evidence, now - timedelta(days=7))["score"]
        change = score_now - score_then
        trend = f"up {change}" if change > 0 else f"down {-change}" if change < 0 else "unchanged"
        bullets.append(f"Readiness for {target.title}: {score_now}/100 ({trend} this week).")

    apps = db.scalars(select(Application).where(Application.user_id == user.id)).all()
    moved = sum(1 for a in apps for h in (a.status_history or [])
                if start.isoformat() <= h.get("at", "")[:10] < end.isoformat())
    if moved:
        bullets.append(f"{moved} application update{'s' if moved != 1 else ''} last week.")
    if s["dueCards"]:
        bullets.append(f"{s['dueCards']} mistakes are waiting in your review queue.")
    name = (user.name or "").split(" ")[0]
    intro = ("A strong week. Keep the rhythm going." if len(days) >= learning.WEEKLY_GOAL_DAYS
             else "A few minutes a day adds up. Here is where you stand.")
    return mailer.Email(
        to=user.email, subject=f"Your week: {len(days)} practice day{'s' if len(days) != 1 else ''}",
        heading=f"Your week in review{', ' + name if name else ''}", paragraphs=[intro], bullets=bullets,
        cta_label="Plan this week", cta_url=_url("/home"),
        footer="You get this because you turned on the weekly summary. Change it in Settings.",
        **mailer.unsubscribe_links(user.id))


# ---------------------------------------------------------------- the hourly run
def _send_once(db: Session, user_id: int, kind: str, ref: str, mail: mailer.Email) -> bool:
    """Claim (user, kind, ref) first so concurrent or repeated runs cannot send twice."""
    db.add(EmailLog(user_id=user_id, kind=kind, ref=ref))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return False
    if mailer.send(mail):
        return True
    # Release the claim so a manual re-run within the hour can retry.
    claim = (EmailLog.user_id == user_id) & (EmailLog.kind == kind) & (EmailLog.ref == ref)
    db.query(EmailLog).filter(claim).delete()
    db.commit()
    return False


def run(db: Session, now: datetime) -> dict:
    counts = {"checked": 0, "sent": 0, "nothingToSend": 0}
    wanted = or_(EmailPreference.daily, EmailPreference.weekly)
    prefs = db.scalars(select(EmailPreference).where(wanted)).all()
    for p in prefs:
        local = local_time(p, now)
        if local.hour != p.send_hour:
            continue
        user = db.get(User, p.user_id)
        if user is None:
            continue
        counts["checked"] += 1
        if p.daily:
            mail = daily_email(db, user, local, now)
            if mail is None:
                counts["nothingToSend"] += 1
            elif _send_once(db, user.id, "daily", local.date().isoformat(), mail):
                counts["sent"] += 1
        if p.weekly and local.weekday() == 0:
            year, week, _ = local.isocalendar()
            if _send_once(db, user.id, "weekly", f"{year}-W{week:02d}", weekly_email(db, user, local, now)):
                counts["sent"] += 1
    log.info("Reminders run: %s", counts)
    return counts
