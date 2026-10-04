from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..config import get_settings
from ..credits import charge
from ..db import get_db
from ..models import Negotiation, User
from ..ratelimit import limiter
from ..security import current_user
from ..services import negotiation as svc

router = APIRouter(prefix="/api/negotiation", tags=["negotiation"])


def _view(row: Negotiation) -> dict:
    completed = row.status == "completed"
    return {
        "id": row.id,
        "roleTitle": row.role_title,
        "level": row.level,
        "location": row.location,
        "companyType": row.company_type,
        "status": row.status,
        "scenario": svc.public_scenario(row.scenario),
        "offer": row.offer,
        "transcript": row.transcript,
        "messagesLeft": max(0, svc.MAX_MESSAGES - sum(1 for t in row.transcript if t["role"] == "candidate")),
        # The hidden ceiling is only revealed in the debrief.
        "report": row.report if completed else None,
        "createdAt": row.created_at.isoformat(),
    }


def _own(db: Session, user: User, nid: int) -> Negotiation:
    row = db.get(Negotiation, nid)
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Negotiation not found.")
    return row


class StartIn(BaseModel):
    role_title: str = Field(min_length=2, max_length=120)
    level: svc.Level = "mid"
    location: str = Field(default="United States", min_length=2, max_length=120)
    company_type: svc.CompanyType = "mid_size"
    your_offer: int | None = Field(default=None, ge=1000, le=10_000_000)
    competing_offer: int | None = Field(default=None, ge=1000, le=10_000_000)


@router.post("/start", status_code=201)
def start(body: StartIn, response: Response, user: User = Depends(current_user),
          db: Session = Depends(get_db)):
    with charge(db, user, "negotiation_start", response):
        scenario = svc.create_scenario(body.role_title.strip(), body.level, body.location.strip(),
                                       body.company_type, body.your_offer, body.competing_offer, user.id)
    row = Negotiation(user_id=user.id, role_title=body.role_title.strip(), level=body.level,
                      location=body.location.strip(), company_type=body.company_type, scenario=scenario,
                      offer=svc.initial_offer(scenario),
                      transcript=[{"role": "recruiter", "text": scenario["opening_message"]}])
    db.add(row)
    db.commit()
    return _view(row)


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@router.post("/{nid}/message")
def message(nid: int, body: MessageIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = _own(db, user, nid)
    if row.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "The recruiter has made a final offer. Get your debrief.")
    limiter.hit(f"ai:{user.id}", get_settings().ai_requests_per_minute)
    transcript = [*row.transcript, {"role": "candidate", "text": body.text.strip()}]
    # If the recruiter turn fails nothing is saved, so the user can simply resend.
    reply, offer, final = svc.recruiter_turn(row.scenario, transcript, row.offer, user.id)
    transcript.append({"role": "recruiter", "text": reply})
    row.transcript = transcript
    row.offer = offer
    if final or sum(1 for t in transcript if t["role"] == "candidate") >= svc.MAX_MESSAGES:
        row.status = "final"
    flag_modified(row, "offer")
    db.commit()
    return _view(row)


@router.post("/{nid}/finish")
def finish(nid: int, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = _own(db, user, nid)
    if row.status == "completed":
        return _view(row)
    if not any(t["role"] == "candidate" for t in row.transcript):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Respond to the offer at least once first.")
    result = svc.outcome(row.scenario, row.offer)
    with charge(db, user, "negotiation_report", response):
        coaching = svc.debrief(row.scenario, row.transcript, result, user.id)
    row.report = {**coaching, "outcome": result,
                  "market": {k: row.scenario[k] for k in ("market_low", "market_mid", "market_high")}}
    row.status = "completed"
    db.commit()
    return _view(row)


@router.get("")
def history(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Negotiation).where(Negotiation.user_id == user.id)
                      .order_by(Negotiation.created_at.desc()).limit(30)).all()
    return {"negotiations": [{
        "id": r.id, "roleTitle": r.role_title, "status": r.status,
        "score": r.report["overall_score"] if r.report else None,
        "gain": r.report["outcome"]["firstYearGain"] if r.report else None,
        "currency": r.scenario["currency"], "createdAt": r.created_at.isoformat(),
    } for r in rows]}


@router.get("/{nid}")
def detail(nid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _view(_own(db, user, nid))
