from __future__ import annotations

import re
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..credits import charge
from ..db import get_db
from ..models import ProofAssessment, User
from ..security import current_user
from ..services import learning, readiness
from ..services import proof as svc

router = APIRouter(prefix="/api/proof", tags=["proof"])


def skill_key(skill: str) -> str:
    return re.sub(r"[^a-z0-9+#]+", " ", skill.lower()).strip()


def _current(row: ProofAssessment) -> dict | None:
    if row.status != "active" or not row.served:
        return None
    last = row.served[-1]
    q = next(q for q in row.pool if q["id"] == last["qid"])
    return {**svc.public_question(q), "secondsLeft": svc.seconds_left(last["served_at"])}


def _view(row: ProofAssessment) -> dict:
    data = {
        "id": row.id,
        "skill": row.skill,
        "status": row.status,
        "questionNumber": len(row.served),
        "total": svc.QUESTIONS_PER_TEST,
        "secondsPerQuestion": svc.SECONDS_PER_QUESTION,
        "question": _current(row),
        "createdAt": row.created_at.isoformat(),
    }
    if row.status == "completed":
        by_id = {q["id"]: q for q in row.pool}
        data["result"] = {
            **svc.score(row.served),
            "focusLost": row.focus_lost,
            "completedAt": row.completed_at.isoformat() if row.completed_at else None,
            "review": [{**by_id[s["qid"]], "tier": svc.TIER_NAMES[s["tier"]],
                        "userAnswer": s.get("answer", ""), "correct": s.get("correct", False),
                        "late": s.get("late", False)} for s in row.served],
        }
    return data


def _own(db: Session, user: User, proof_id: int) -> ProofAssessment:
    row = db.get(ProofAssessment, proof_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Skill proof not found.")
    return row


def _serve(row: ProofAssessment) -> bool:
    """Serve the next question at the current tier; False when the pool is exhausted."""
    used = {s["qid"] for s in row.served}
    q = svc.pick_question(row.pool, used, row.current_tier)
    if q is None:
        return False
    row.served = [*row.served, {"qid": q["id"], "tier": q["tier"],
                                "served_at": svc.now_utc().isoformat()}]
    return True


class StartIn(BaseModel):
    skill: str = Field(min_length=1, max_length=60)


@router.post("/start", status_code=201)
def start(body: StartIn, response: Response, user: User = Depends(current_user),
          db: Session = Depends(get_db)):
    skill = body.skill.strip()
    key = skill_key(skill)
    recent = db.scalars(select(ProofAssessment).where(
        ProofAssessment.user_id == user.id, ProofAssessment.skill_key == key)
        .order_by(ProofAssessment.created_at.desc()).limit(1)).first()
    if recent is not None:
        if recent.status == "active":
            return _view(recent)  # resume an unfinished proof instead of charging again
        created = readiness._as_utc(recent.created_at)
        wait = created + timedelta(hours=svc.COOLDOWN_HOURS) - svc.now_utc()
        if wait.total_seconds() > 0:
            hours = max(1, round(wait.total_seconds() / 3600))
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                                f"You can retake the {skill} proof in about {hours} hour"
                                f"{'s' if hours != 1 else ''}. Proofs are limited to one per skill "
                                "per day so results stay meaningful.")

    with charge(db, user, "proof_assessment", response):
        pool = svc.generate_pool(skill, user.id)
    row = ProofAssessment(user_id=user.id, skill=skill, skill_key=key, pool=pool, served=[],
                          current_tier=svc.START_TIER, focus_lost=0,
                          created_at=svc.now_utc())
    _serve(row)
    db.add(row)
    db.commit()
    return _view(row)


class AnswerIn(BaseModel):
    answer: str = Field(default="", max_length=1)  # "" = skipped / timed out
    focus_lost: int = Field(default=0, ge=0, le=1000)


@router.post("/{proof_id}/answer")
def answer(proof_id: int, body: AnswerIn, user: User = Depends(current_user),
           db: Session = Depends(get_db)):
    row = _own(db, user, proof_id)
    if row.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "This proof is already complete.")
    served = [dict(s) for s in row.served]
    current = served[-1]
    q = next(q for q in row.pool if q["id"] == current["qid"])
    late = svc.is_late(current["served_at"])
    given = body.answer.strip().upper()
    current.update(answer=given, answered_at=svc.now_utc().isoformat(), late=late,
                   correct=bool(given) and given == q["answer"] and not late)
    row.served = served
    row.focus_lost = max(row.focus_lost, body.focus_lost)
    row.current_tier = svc.next_tier(row.current_tier, current["correct"])

    if len(served) >= svc.QUESTIONS_PER_TEST or not _serve(row):
        result = svc.score(row.served)
        row.status = "completed"
        row.level = result["level"]
        row.proficiency = result["proficiency"]
        row.completed_at = svc.now_utc()
        by_id = {q["id"]: q for q in row.pool}
        missed = [by_id[s["qid"]] for s in row.served if not s.get("correct")]
        learning.add_cards(db, user.id, "proof", missed, skill_of=lambda q: row.skill)
        learning.log_practice(db, user.id, "proof")
        db.commit()
        readiness.record_evidence(db, user.id, "proof_assessment", row.skill, result["proficiency"],
                                  payload={"proofId": row.id, "level": result["level"]})
    else:
        db.commit()
    return _view(row)


@router.get("")
def list_proofs(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(ProofAssessment).where(ProofAssessment.user_id == user.id)
                      .order_by(ProofAssessment.created_at.desc()).limit(100)).all()
    return {"proofs": [{"id": r.id, "skill": r.skill, "status": r.status, "level": r.level,
                        "proficiency": r.proficiency, "createdAt": r.created_at.isoformat()}
                       for r in rows]}


@router.get("/{proof_id}")
def detail(proof_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _view(_own(db, user, proof_id))
