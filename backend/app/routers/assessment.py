from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..credits import charge
from ..db import get_db
from ..models import User
from ..security import current_user
from ..services import assessment as svc

router = APIRouter(prefix="/api/assessment", tags=["assessment"])


class QuestionsIn(BaseModel):
    skills: list[str] = Field(min_length=1, max_length=8)
    difficulty: svc.Difficulty
    count: int = Field(default=10, ge=5, le=15)


@router.post("/questions")
def questions(body: QuestionsIn, response: Response, user: User = Depends(current_user),
              db: Session = Depends(get_db)):
    skills = [s.strip()[:60] for s in body.skills if s.strip()]
    with charge(db, user, "assessment_questions", response):
        return {"questions": svc.generate_questions(skills, body.difficulty, body.count, user.id)}


class QuestionResult(BaseModel):
    question: str = Field(max_length=2000)
    topic: str = Field(default="", max_length=200)
    skill: str = Field(default="", max_length=100)
    user_answer: str = Field(default="", max_length=1000)
    correct_answer: str = Field(default="", max_length=1000)
    is_correct: bool


class LearningPathIn(BaseModel):
    skills: list[str] = Field(min_length=1, max_length=8)
    difficulty: svc.Difficulty
    score: int = Field(ge=0, le=100)
    results: list[QuestionResult] = Field(min_length=1, max_length=20)


@router.post("/learning-path")
def learning_path(body: LearningPathIn, response: Response, user: User = Depends(current_user),
                  db: Session = Depends(get_db)):
    with charge(db, user, "learning_path", response):
        return svc.build_learning_path(body.skills, body.difficulty, body.score,
                                       [r.model_dump() for r in body.results], user.id)
