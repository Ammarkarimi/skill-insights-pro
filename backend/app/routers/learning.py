from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AssessmentSession, LearningPlan, ReviewCard, User, utcnow
from ..security import current_user
from ..services import learning as svc

router = APIRouter(prefix="/api/learning", tags=["learning"])


def _own_plan(db: Session, user: User, plan_id: int) -> LearningPlan:
    plan = db.get(LearningPlan, plan_id)
    if plan is None or plan.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Learning plan not found.")
    return plan


@router.get("/summary")
def summary(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return svc.summary(db, user.id)


@router.get("/plans")
def plans(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(LearningPlan).where(LearningPlan.user_id == user.id)
                      .order_by(LearningPlan.created_at.desc()).limit(50)).all()
    return {"plans": [svc.plan_brief(p) for p in rows]}


@router.get("/plans/{plan_id}")
def plan(plan_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return svc.plan_view(_own_plan(db, user, plan_id))


class ProgressIn(BaseModel):
    week: int | None = Field(default=None, ge=1, le=52)
    resource: str | None = Field(default=None, max_length=1000)
    done: bool


@router.patch("/plans/{plan_id}/progress")
def progress(plan_id: int, body: ProgressIn, user: User = Depends(current_user),
             db: Session = Depends(get_db)):
    plan = _own_plan(db, user, plan_id)
    current = {"weeks": [], "resources": [], **(plan.progress or {})}
    if body.week is not None:
        if body.week not in svc.weeks_of(plan):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That week is not in this plan.")
        weeks = set(current["weeks"]) - {body.week}
        current["weeks"] = sorted(weeks | {body.week} if body.done else weeks)
    if body.resource is not None:
        links = {r.get("link") for r in plan.content.get("learningPath", [])}
        if body.resource not in links:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That resource is not in this plan.")
        done = set(current["resources"]) - {body.resource}
        current["resources"] = sorted(done | {body.resource} if body.done else done)
    plan.progress = current
    if body.done:
        svc.log_practice(db, user.id, "plan")
    plan.status = "completed" if svc.weeks_of(plan) and svc.next_week(plan) is None else "active"
    plan.updated_at = utcnow()
    db.commit()
    return svc.plan_view(plan)


@router.delete("/plans/{plan_id}", status_code=204)
def delete_plan(plan_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own_plan(db, user, plan_id))
    db.commit()
    return Response(status_code=204)


class RetestIn(BaseModel):
    session_id: int


@router.post("/plans/{plan_id}/retest")
def link_retest(plan_id: int, body: RetestIn, user: User = Depends(current_user),
                db: Session = Depends(get_db)):
    """Attach a submitted assessment taken after the plan, to show the before/after change."""
    plan = _own_plan(db, user, plan_id)
    session = db.get(AssessmentSession, body.session_id)
    if session is None or session.user_id != user.id or session.score is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Submit the re-test first.")
    taken_before = svc.as_utc(session.created_at) < svc.as_utc(plan.created_at)
    if session.id == plan.assessment_session_id or taken_before:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "The re-test must be taken after the plan was created.")
    plan.retest_session_id = session.id
    plan.retest_score = session.score
    plan.updated_at = utcnow()
    db.commit()
    return svc.plan_view(plan)


# ---------------------------------------------------------------- daily review
@router.get("/review")
def review(user: User = Depends(current_user), db: Session = Depends(get_db)):
    due = svc.due_cards(db, user.id)
    return {"cards": [svc.public_card(c) for c in due[: svc.REVIEW_BATCH]], "dueCount": len(due)}


class ReviewAnswerIn(BaseModel):
    answer: str = Field(pattern=r"^[A-D]$")


@router.post("/review/{card_id}")
def answer_card(card_id: int, body: ReviewAnswerIn, user: User = Depends(current_user),
                db: Session = Depends(get_db)):
    card = db.get(ReviewCard, card_id)
    if card is None or card.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Card not found.")
    if svc.as_utc(card.due_at) > svc.now_utc():
        raise HTTPException(status.HTTP_409_CONFLICT, "This card is not due yet.")
    result = svc.grade_card(card, body.answer)
    svc.log_practice(db, user.id, "review")
    db.commit()
    return result
