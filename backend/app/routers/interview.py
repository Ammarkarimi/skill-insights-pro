from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..credits import charge
from ..db import get_db
from ..models import DeepInterview, InterviewSession, User
from ..security import current_user
from ..services import interview as svc
from ..services import readiness
from ..services.assessment import Difficulty

router = APIRouter(prefix="/api/interview", tags=["interview"])


class QuestionsIn(BaseModel):
    topic: str = Field(min_length=2, max_length=120)
    difficulty: Difficulty
    count: int = Field(default=5, ge=3, le=10)


@router.post("/questions")
def questions(body: QuestionsIn, response: Response, user: User = Depends(current_user),
              db: Session = Depends(get_db)):
    with charge(db, user, "interview_questions", response):
        return {"questions": svc.generate_interview_questions(body.topic.strip(), body.difficulty,
                                                              body.count, user.id)}


class AnswerIn(BaseModel):
    question: str = Field(max_length=1000)
    answer: str = Field(default="", max_length=6000)


class EvaluateIn(BaseModel):
    topic: str = Field(min_length=2, max_length=120)
    difficulty: Difficulty
    answers: list[AnswerIn] = Field(min_length=1, max_length=10)


@router.post("/evaluate")
def evaluate(body: EvaluateIn, response: Response, user: User = Depends(current_user),
             db: Session = Depends(get_db)):
    with charge(db, user, "interview_evaluation", response):
        result = svc.evaluate_interview(body.topic, body.difficulty,
                                        [a.model_dump() for a in body.answers], user.id)
    session = InterviewSession(user_id=user.id, topic=body.topic, difficulty=body.difficulty,
                               overall_score=result["overall"]["overall_score"], data=result)
    db.add(session)
    db.commit()
    readiness.record_interview(db, user.id, body.topic, session.overall_score, session.id)
    return {**result, "id": session.id, "createdAt": session.created_at.isoformat()}


@router.get("/history")
def history(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(InterviewSession).where(InterviewSession.user_id == user.id)
                      .order_by(InterviewSession.created_at.desc()).limit(30)).all()
    deep = db.scalars(select(DeepInterview).where(DeepInterview.user_id == user.id,
                                                  DeepInterview.status == "completed")
                      .order_by(DeepInterview.created_at.desc()).limit(30)).all()
    items = [{"id": r.id, "kind": "quick", "topic": r.topic, "difficulty": r.difficulty,
              "overallScore": r.overall_score, "createdAt": r.created_at.isoformat()} for r in rows]
    items += [{"id": d.id, "kind": "deep", "topic": f"Defend your resume: {d.role_title}",
               "difficulty": "adaptive", "overallScore": d.overall_score,
               "createdAt": d.created_at.isoformat()} for d in deep]
    items.sort(key=lambda x: x["createdAt"], reverse=True)
    return {"interviews": items[:30]}


@router.get("/{interview_id}")
def detail(interview_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.get(InterviewSession, interview_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Interview not found.")
    return {**row.data, "id": row.id, "createdAt": row.created_at.isoformat()}
