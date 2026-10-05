"""Learning loop: saved plans, spaced repetition of past mistakes, and the practice streak.

Everything here is deterministic and free: no AI calls.
"""

from __future__ import annotations

import hashlib
from datetime import date, datetime, timedelta, timezone
from urllib.parse import quote

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import LearningPlan, PracticeLog, ReviewCard

# Leitner boxes: a correct answer moves a card up a box (seen less often), a wrong one back to box 1.
BOX_DAYS = {1: 1, 2: 3, 3: 7, 4: 14, 5: 30}
REVIEW_BATCH = 10
WEEKLY_GOAL_DAYS = 5
MAX_CARDS = 500


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# ---------------------------------------------------------------- review cards
def _hash(q: dict) -> str:
    options = "|".join(sorted(str(v) for v in (q.get("options") or {}).values()))
    return hashlib.sha256(f"{q.get('question', '')}\n{options}".encode()).hexdigest()


def card_payload(q: dict) -> dict:
    """The parts of a missed question worth reviewing (works for assessment, proof and aptitude items)."""
    return {k: q.get(k) for k in ("question", "code", "passage", "options", "answer", "explanation", "topic")}


def add_cards(db: Session, user_id: int, source: str, missed: list[dict], skill_of=lambda q: "") -> int:
    """Queue missed questions for review, due now. A question missed again goes back to box 1."""
    if not missed:
        return 0
    now = now_utc()
    existing = {c.qhash: c for c in db.scalars(select(ReviewCard).where(ReviewCard.user_id == user_id))}
    room = MAX_CARDS - len(existing)
    added: set[str] = set()
    for q in missed:
        h = _hash(q)
        if h in existing:
            existing[h].box, existing[h].due_at = 1, now
        elif h not in added and len(added) < room:
            db.add(ReviewCard(user_id=user_id, qhash=h, source=source, skill=(skill_of(q) or "")[:120],
                              question=card_payload(q), box=1, due_at=now, reviews=0))
            added.add(h)
    return len(added)


def due_cards(db: Session, user_id: int, now: datetime | None = None) -> list[ReviewCard]:
    now = now or now_utc()
    return list(db.scalars(select(ReviewCard).where(ReviewCard.user_id == user_id, ReviewCard.due_at <= now)
                           .order_by(ReviewCard.box, ReviewCard.due_at)))


def public_card(card: ReviewCard) -> dict:
    q = card.question
    return {"id": card.id, "source": card.source, "skill": card.skill, "box": card.box,
            "question": q.get("question"), "code": q.get("code"), "passage": q.get("passage"),
            "options": q.get("options"), "topic": q.get("topic")}


def grade_card(card: ReviewCard, answer: str, now: datetime | None = None) -> dict:
    now = now or now_utc()
    correct = answer == card.question.get("answer")
    card.box = min(5, card.box + 1) if correct else 1
    card.due_at = now + timedelta(days=BOX_DAYS[card.box])
    card.reviews += 1
    card.last_correct = correct
    return {"correct": correct, "answer": card.question.get("answer"),
            "explanation": card.question.get("explanation"), "box": card.box,
            "nextDue": card.due_at.isoformat()}


# ---------------------------------------------------------------- practice log and streak
def log_practice(db: Session, user_id: int, kind: str, count: int = 1, now: datetime | None = None) -> None:
    day = (now or now_utc()).date().isoformat()
    row = db.scalar(select(PracticeLog).where(PracticeLog.user_id == user_id, PracticeLog.day == day,
                                              PracticeLog.kind == kind))
    if row is None:
        db.add(PracticeLog(user_id=user_id, day=day, kind=kind, count=count))
    else:
        row.count += count


def streak(days: set[str], today: date) -> int:
    """Consecutive practice days ending today, or yesterday if today has no practice yet."""
    cursor = today if today.isoformat() in days else today - timedelta(days=1)
    count = 0
    while cursor.isoformat() in days:
        count += 1
        cursor -= timedelta(days=1)
    return count


def summary(db: Session, user_id: int, now: datetime | None = None) -> dict:
    now = now or now_utc()
    today = now.date()
    since = (today - timedelta(days=400)).isoformat()
    logs = db.scalars(select(PracticeLog).where(PracticeLog.user_id == user_id, PracticeLog.day >= since))
    per_day: dict[str, int] = {}
    for log in logs:
        per_day[log.day] = per_day.get(log.day, 0) + log.count
    week_start = today - timedelta(days=today.weekday())
    week_days = sum(1 for d in per_day if d >= week_start.isoformat())
    last7 = [{"date": (today - timedelta(days=i)).isoformat(),
              "count": per_day.get((today - timedelta(days=i)).isoformat(), 0)} for i in range(6, -1, -1)]
    plans = db.scalars(select(LearningPlan).where(LearningPlan.user_id == user_id,
                                                  LearningPlan.status == "active")
                       .order_by(LearningPlan.updated_at.desc())).all()
    return {
        "streak": streak(set(per_day), today),
        "practicedToday": today.isoformat() in per_day,
        "last7": last7,
        "weekGoal": {"target": WEEKLY_GOAL_DAYS, "done": min(week_days, 7)},
        "dueCards": len(due_cards(db, user_id, now)),
        "totalCards": len(list(db.scalars(select(ReviewCard.id).where(ReviewCard.user_id == user_id)))),
        "activePlans": [plan_brief(p) for p in plans[:3]],
    }


# ---------------------------------------------------------------- plans
def weeks_of(plan: LearningPlan) -> list[int]:
    return [w["week"] for w in plan.content.get("weeklyPlan", [])]


def progress_pct(plan: LearningPlan) -> int:
    weeks = weeks_of(plan)
    done = set((plan.progress or {}).get("weeks", [])) & set(weeks)
    return round(100 * len(done) / len(weeks)) if weeks else 0


def next_week(plan: LearningPlan) -> int | None:
    done = set((plan.progress or {}).get("weeks", []))
    return next((w for w in weeks_of(plan) if w not in done), None)


def plan_brief(plan: LearningPlan) -> dict:
    return {"id": plan.id, "title": plan.content.get("title", "Learning plan"), "skills": plan.skills,
            "difficulty": plan.difficulty, "baselineScore": plan.baseline_score,
            "retestScore": plan.retest_score, "progressPct": progress_pct(plan), "nextWeek": next_week(plan),
            "status": plan.status, "createdAt": as_utc(plan.created_at).isoformat()}


def plan_view(plan: LearningPlan) -> dict:
    return {**plan_brief(plan), "content": plan.content,
            "progress": {"weeks": [], "resources": [], **(plan.progress or {})},
            "retestHref": retest_href(plan)}


def retest_href(plan: LearningPlan) -> str:
    return (f"/skill-assessment?skills={quote(','.join(plan.skills))}&difficulty={plan.difficulty}"
            f"&plan={plan.id}")
