from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..credits import charge
from ..db import get_db
from ..models import AssessmentSession, LearningPlan, User, utcnow
from ..security import current_user
from ..services import assessment as svc
from ..services import learning, readiness

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
        generated = svc.generate_questions(skills, body.difficulty, body.count, user.id)
    session = AssessmentSession(user_id=user.id, skills=skills, difficulty=body.difficulty,
                                questions=generated)
    db.add(session)
    db.commit()
    return {"sessionId": session.id, "questions": svc.public_questions(generated)}


def _own_session(db: Session, user: User, session_id: int) -> AssessmentSession:
    session = db.get(AssessmentSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found.")
    return session


class SubmitIn(BaseModel):
    # question id -> chosen option letter ("" or missing = unanswered)
    answers: dict[int, str] = Field(max_length=20)


@router.post("/{session_id}/submit")
def submit(session_id: int, body: SubmitIn, user: User = Depends(current_user),
           db: Session = Depends(get_db)):
    session = _own_session(db, user, session_id)
    if session.result is not None:  # idempotent: a double-click or retry returns the same grade
        return {"sessionId": session.id, **session.result}
    answers = {qid: a.strip().upper()[:1] for qid, a in body.answers.items()}
    result = svc.grade(session.questions, answers)
    session.result = result
    session.score = result["score"]
    session.submitted_at = utcnow()
    missed = [q for q in result["questions"] if not q["is_correct"]]
    learning.add_cards(db, user.id, "assessment", missed, skill_of=lambda q: q.get("skill") or "")
    learning.log_practice(db, user.id, "assessment")
    db.commit()
    readiness.record_assessment(db, user.id, session.id, session.difficulty, result["perSkill"])
    return {"sessionId": session.id, **result}


class LearningPathIn(BaseModel):
    session_id: int


@router.post("/learning-path")
def learning_path(body: LearningPathIn, response: Response, user: User = Depends(current_user),
                  db: Session = Depends(get_db)):
    session = _own_session(db, user, body.session_id)
    if session.result is None:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Submit the assessment before requesting a learning path.")
    with charge(db, user, "learning_path", response):
        content = svc.build_learning_path(session.skills, session.difficulty, session.result["score"],
                                          svc.learning_path_inputs(session.result["questions"]), user.id)
    # Saved so the user can track it week by week and re-test against the same baseline.
    plan = LearningPlan(user_id=user.id, assessment_session_id=session.id, skills=session.skills,
                        difficulty=session.difficulty, baseline_score=session.result["score"],
                        content=content, progress={"weeks": [], "resources": []})
    db.add(plan)
    db.commit()
    return {**content, "id": plan.id}
