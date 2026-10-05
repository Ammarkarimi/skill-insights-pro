from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..credits import charge
from ..db import get_db
from ..models import AptitudeTest, User
from ..ratelimit import limiter
from ..security import current_user
from ..services import aptitude as svc
from ..services import readiness

router = APIRouter(prefix="/api/aptitude", tags=["aptitude"])


def _own(db: Session, user: User, test_id: int) -> AptitudeTest:
    row = db.get(AptitudeTest, test_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Test not found.")
    return row


def _expired(row: AptitudeTest) -> bool:
    return svc.now_utc() > svc.as_utc(row.deadline_at) + timedelta(seconds=svc.GRACE_SECONDS)


def _finish(db: Session, row: AptitudeTest) -> None:
    """Grade the saved answers, record evidence once, and close the test."""
    if row.status == "completed":
        return
    result = svc.grade(row.questions, row.answers or {})
    last = max((a["at"] for a in (row.answers or {}).values()), default=None)
    ended = svc.as_utc(datetime.fromisoformat(last)) if last else svc.now_utc()
    result["minutesUsed"] = round((ended - svc.as_utc(row.started_at)).total_seconds() / 60, 1)
    row.result = result
    row.score = result["score"]
    row.status = "completed"
    row.completed_at = svc.now_utc()
    db.commit()
    target = readiness.active_target(db, row.user_id)
    for section, bucket in result["perSection"].items():
        names = svc.EVIDENCE_SKILLS[section]
        match = next((n for n in names if readiness.match_requirement(target, n)), None)
        if match:
            readiness.record_evidence(db, row.user_id, "aptitude", match, bucket["score"], target=target,
                                      payload={"aptitudeTestId": row.id, "section": section}, commit=False)
    db.commit()


def _view(row: AptitudeTest) -> dict:
    data = {
        "id": row.id,
        "section": row.section,
        "difficulty": row.difficulty,
        "status": row.status,
        "total": len(row.questions),
        "startedAt": svc.as_utc(row.started_at).isoformat(),
        "deadlineAt": svc.as_utc(row.deadline_at).isoformat(),
        "secondsLeft": max(0, round((svc.as_utc(row.deadline_at) - svc.now_utc()).total_seconds())),
    }
    if row.status == "active":
        data["questions"] = [svc.public(q) for q in row.questions]
        data["answers"] = {k: v["answer"] for k, v in (row.answers or {}).items()}
    else:
        data["result"] = row.result
        data["completedAt"] = svc.as_utc(row.completed_at).isoformat() if row.completed_at else None
    return data


class StartIn(BaseModel):
    section: svc.Section
    difficulty: svc.Difficulty = "medium"


@router.post("/start", status_code=201)
def start(body: StartIn, response: Response, user: User = Depends(current_user),
          db: Session = Depends(get_db)):
    active = db.scalars(select(AptitudeTest).where(AptitudeTest.user_id == user.id,
                                                    AptitudeTest.status == "active")).all()
    for row in active:
        if not _expired(row):
            return _view(row)  # one test at a time: resume it instead of starting (and paying) again
        _finish(db, row)
    limiter.hit(f"aptitude:{user.id}", get_settings().ai_requests_per_minute)

    if svc.uses_ai(body.section):
        with charge(db, user, "aptitude_test", response):
            questions = svc.build_test(body.section, body.difficulty, user.id)
    else:
        questions = svc.build_test(body.section, body.difficulty, user.id)  # templated only: free
    started = svc.now_utc()
    row = AptitudeTest(user_id=user.id, section=body.section, difficulty=body.difficulty,
                       questions=questions, answers={}, started_at=started,
                       deadline_at=svc.deadline_for(started, len(questions)))
    db.add(row)
    db.commit()
    return _view(row)


class AnswerIn(BaseModel):
    question_id: int
    answer: str = Field(default="", pattern=r"^[A-D]?$")


@router.post("/{test_id}/answer")
def answer(test_id: int, body: AnswerIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = _own(db, user, test_id)
    if row.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "This test is already finished.")
    if _expired(row):
        _finish(db, row)
        raise HTTPException(status.HTTP_409_CONFLICT, "Time is up. Your answers so far have been graded.")
    if not any(q["id"] == body.question_id for q in row.questions):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown question.")
    answers = dict(row.answers or {})
    answers[str(body.question_id)] = {"answer": body.answer, "at": svc.now_utc().isoformat()}
    row.answers = answers
    db.commit()
    return {"saved": True, "secondsLeft": _view(row)["secondsLeft"]}


@router.post("/{test_id}/submit")
def submit(test_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = _own(db, user, test_id)
    _finish(db, row)
    return _view(row)


@router.get("")
def history(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(AptitudeTest).where(AptitudeTest.user_id == user.id)
                      .order_by(AptitudeTest.started_at.desc()).limit(50)).all()
    return {"tests": [{"id": r.id, "section": r.section, "difficulty": r.difficulty, "status": r.status,
                       "score": r.score, "total": len(r.questions),
                       "startedAt": svc.as_utc(r.started_at).isoformat()} for r in rows]}


@router.get("/{test_id}")
def detail(test_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = _own(db, user, test_id)
    if row.status == "active" and _expired(row):
        _finish(db, row)
    return _view(row)
