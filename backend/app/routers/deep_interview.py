from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..config import get_settings
from ..credits import charge
from ..db import get_db
from ..documents import resume_text_from_upload
from ..models import DeepInterview, TargetRole, User, utcnow
from ..ratelimit import limiter
from ..security import current_user
from ..services import deep_interview as svc
from ..services import readiness

router = APIRouter(prefix="/api/deep-interview", tags=["deep-interview"])


def _question(topic: dict, text: str, kind: str) -> dict:
    return {"role": "interviewer", "topic": topic["index"], "kind": kind, "text": text}


def _view(row: DeepInterview) -> dict:
    """Client view: transcript, current question and claims; prepared rubrics stay server-side."""
    last = row.transcript[-1] if row.transcript else None
    return {
        "id": row.id,
        "roleTitle": row.role_title,
        "status": row.status,
        "topicCount": len(row.plan),
        "currentTopic": row.current_topic,
        "topics": [{"index": t["index"], "requirement": t["requirement"], "claim": t["claim"]}
                   for t in row.plan],
        "transcript": row.transcript,
        "question": last if last and last["role"] == "interviewer" and row.status == "active" else None,
        "answers": sum(1 for t in row.transcript if t["role"] == "candidate"),
        "report": row.report,
        "createdAt": row.created_at.isoformat(),
    }


def _own(db: Session, user: User, interview_id: int) -> DeepInterview:
    row = db.get(DeepInterview, interview_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Interview not found.")
    return row


@router.post("/start", status_code=201)
def start(response: Response, resume: UploadFile = File(...),
          n_topics: int = Form(default=5, ge=3, le=6),
          role_title: str = Form(default="", max_length=120),
          user: User = Depends(current_user), db: Session = Depends(get_db)):
    text = resume_text_from_upload(resume)
    target = readiness.active_target(db, user.id)
    title = role_title.strip() or (target.title if target else "")
    if not title:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Set a target role on the dashboard or enter the role you are interviewing for.")
    with charge(db, user, "deep_interview_start", response):
        plan = svc.plan_interview(text, title, target, n_topics, user.id)
    first = plan[0]
    row = DeepInterview(user_id=user.id, target_role_id=target.id if target else None, role_title=title,
                        plan=plan, transcript=[_question(first, first["opening_question"], "opening")])
    db.add(row)
    db.commit()
    return _view(row)


class Metrics(BaseModel):
    mode: Literal["voice", "typed"] = "typed"
    words: int = Field(default=0, ge=0, le=5000)
    durationSec: float = Field(default=0, ge=0, le=3600)
    wpm: float = Field(default=0, ge=0, le=1000)
    fillers: int = Field(default=0, ge=0, le=2000)
    longPauses: int = Field(default=0, ge=0, le=500)


class AnswerIn(BaseModel):
    answer: str = Field(min_length=1, max_length=6000)
    metrics: Metrics | None = None


@router.post("/{interview_id}/answer")
def answer(interview_id: int, body: AnswerIn, user: User = Depends(current_user),
           db: Session = Depends(get_db)):
    row = _own(db, user, interview_id)
    if row.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "This interview is not accepting answers.")
    limiter.hit(f"ai:{user.id}", get_settings().ai_requests_per_minute)

    topic = row.plan[row.current_topic]
    row.transcript.append({"role": "candidate", "topic": topic["index"], "text": body.answer.strip(),
                           "metrics": body.metrics.model_dump() if body.metrics else None})
    answers = sum(1 for t in row.transcript if t["role"] == "candidate")

    follow_up = None
    if answers < svc.MAX_ANSWERS:
        follow_up = svc.decide_next(topic, row.transcript, row.follow_ups, user.id)
    if follow_up:
        row.follow_ups += 1
        row.transcript.append(_question(topic, follow_up, "follow_up"))
    elif row.current_topic + 1 < len(row.plan) and answers < svc.MAX_ANSWERS:
        row.current_topic += 1
        row.follow_ups = 0
        nxt = row.plan[row.current_topic]
        row.transcript.append(_question(nxt, nxt["opening_question"], "opening"))
    else:
        row.status = "ready"  # all topics covered; waiting for the user to request the report
    flag_modified(row, "transcript")
    db.commit()
    return _view(row)


@router.post("/{interview_id}/finish")
def finish(interview_id: int, response: Response, user: User = Depends(current_user),
           db: Session = Depends(get_db)):
    row = _own(db, user, interview_id)
    if row.status == "completed":
        return _view(row)
    if not any(t["role"] == "candidate" for t in row.transcript):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Answer at least one question first.")
    with charge(db, user, "deep_interview_report", response):
        report = svc.final_report(row.role_title, row.plan, row.transcript, user.id)
    row.report = report
    row.overall_score = report["overall"]["overall_score"]
    row.status = "completed"
    row.completed_at = utcnow()
    target = db.get(TargetRole, row.target_role_id) if row.target_role_id else None
    for topic in report["topics"]:
        if topic["answered"]:
            readiness.record_evidence(
                db, user.id, "deep_interview", topic["requirement"], topic["score"] * 10,
                payload={"deepInterviewId": row.id, "verdict": topic["claimVerdict"]},
                target=target, requirement_key=topic["requirementKey"], commit=False)
    db.commit()
    return _view(row)


@router.get("/{interview_id}")
def detail(interview_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _view(_own(db, user, interview_id))
