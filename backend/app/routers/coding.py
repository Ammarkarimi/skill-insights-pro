from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..credits import charge
from ..db import get_db
from ..models import CodingAttempt, CodingSession, User
from ..ratelimit import limiter
from ..security import current_user
from ..services import coding as svc
from ..services import learning, readiness

router = APIRouter(prefix="/api/coding", tags=["coding"])

LATE_GRACE = timedelta(seconds=60)


def _problem(slug: str) -> dict:
    problem = svc.find_problem(slug)
    if problem is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Problem not found.")
    return problem


def _best(attempts: list[CodingAttempt]) -> dict[str, CodingAttempt]:
    best: dict[str, CodingAttempt] = {}
    for a in attempts:
        cur = best.get(a.slug)
        if cur is None or a.passed / a.total > cur.passed / cur.total:
            best[a.slug] = a
    return best


@router.get("/problems")
def problems(user: User = Depends(current_user), db: Session = Depends(get_db)):
    attempts = db.scalars(select(CodingAttempt).where(CodingAttempt.user_id == user.id)).all()
    best = _best(list(attempts))
    return {"problems": [{**svc.summary(p),
                          "solved": p["slug"] in best and best[p["slug"]].passed == best[p["slug"]].total,
                          "attempted": p["slug"] in best} for p in svc.PROBLEMS]}


@router.get("/problems/{slug}")
def problem(slug: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    data = svc.public_problem(_problem(slug))
    last = db.scalars(select(CodingAttempt)
                      .where(CodingAttempt.user_id == user.id, CodingAttempt.slug == slug)
                      .order_by(CodingAttempt.created_at.desc()).limit(1)).first()
    data["lastAttempt"] = _attempt_view(last) if last else None
    return data


def _attempt_view(a: CodingAttempt) -> dict:
    return {"id": a.id, "slug": a.slug, "language": a.language, "code": a.code, "passed": a.passed,
            "total": a.total, "late": a.late, "sessionId": a.session_id, "review": a.review,
            "createdAt": svc.as_utc(a.created_at).isoformat()}


class AttemptIn(BaseModel):
    slug: str = Field(max_length=80)
    language: svc.Language
    code: str = Field(min_length=1, max_length=svc.MAX_CODE_CHARS)
    passed: int = Field(ge=0)
    total: int = Field(ge=1)
    session_id: int | None = None


@router.post("/attempts", status_code=201)
def submit_attempt(body: AttemptIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    limiter.hit(f"coding:{user.id}", 30)
    problem = _problem(body.slug)
    if body.total != len(problem["tests"]) or body.passed > body.total:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Test counts do not match this problem.")
    late = False
    if body.session_id is not None:
        session = _own_session(db, user, body.session_id)
        if body.slug not in session.slugs:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That problem is not part of this assessment.")
        late = session.status != "active" or svc.now_utc() > svc.as_utc(session.deadline_at) + LATE_GRACE
    row = CodingAttempt(user_id=user.id, session_id=body.session_id, slug=body.slug, language=body.language,
                        code=body.code, passed=body.passed, total=body.total, late=late)
    db.add(row)
    learning.log_practice(db, user.id, "coding")
    db.commit()
    return _attempt_view(row)


@router.get("/attempts")
def attempts(slug: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = select(CodingAttempt).where(CodingAttempt.user_id == user.id)
    if slug:
        query = query.where(CodingAttempt.slug == slug)
    rows = db.scalars(query.order_by(CodingAttempt.created_at.desc()).limit(50)).all()
    titles = {p["slug"]: p["title"] for p in svc.PROBLEMS}
    return {"attempts": [{"id": a.id, "slug": a.slug, "title": titles.get(a.slug, a.slug),
                          "language": a.language, "passed": a.passed, "total": a.total,
                          "reviewed": a.review is not None, "score": (a.review or {}).get("score"),
                          "createdAt": svc.as_utc(a.created_at).isoformat()} for a in rows]}


@router.post("/attempts/{attempt_id}/review")
def review(attempt_id: int, response: Response, user: User = Depends(current_user),
           db: Session = Depends(get_db)):
    row = db.get(CodingAttempt, attempt_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attempt not found.")
    if row.review is not None:
        return _attempt_view(row)  # already reviewed: never charge twice
    limiter.hit(f"ai:{user.id}", get_settings().ai_requests_per_minute)
    problem = _problem(row.slug)
    with charge(db, user, "code_review", response):
        row.review = svc.review(problem, row.language, row.code, row.passed, row.total, user.id)
    db.commit()
    target = readiness.active_target(db, user.id)
    for names in svc.evidence_skills(row.language):
        match = next((n for n in names if readiness.match_requirement(target, n)), None)
        if match:
            readiness.record_evidence(db, user.id, "coding_practice", match, row.review["score"],
                                      target=target, commit=False,
                                      payload={"codingAttemptId": row.id, "problem": row.slug})
    db.commit()
    return _attempt_view(row)


# ---------------------------------------------------------------- timed mock OA
def _own_session(db: Session, user: User, session_id: int) -> CodingSession:
    row = db.get(CodingSession, session_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found.")
    return row


def _finish(db: Session, session: CodingSession) -> None:
    if session.status == "completed":
        return
    attempts = db.scalars(select(CodingAttempt).where(CodingAttempt.session_id == session.id,
                                                      CodingAttempt.late.is_(False))).all()
    best = _best(list(attempts))
    per = []
    for slug in session.slugs:
        a = best.get(slug)
        p = svc.find_problem(slug)
        if p is None:
            continue
        per.append({"slug": slug, "title": p["title"], "difficulty": p["difficulty"],
                    "passed": a.passed if a else 0, "total": a.total if a else len(p["tests"]),
                    "attemptId": a.id if a else None})
    score = round(100 * sum(x["passed"] / x["total"] for x in per if x["total"]) / len(per)) if per else 0
    session.result = {"score": score, "problems": per,
                      "solved": sum(1 for x in per if x["total"] and x["passed"] == x["total"])}
    session.status = "completed"
    session.completed_at = svc.now_utc()
    db.commit()


def _session_view(session: CodingSession) -> dict:
    return {
        "id": session.id,
        "level": session.level,
        "status": session.status,
        "problems": [svc.summary(svc.find_problem(s)) for s in session.slugs if svc.find_problem(s)],
        "deadlineAt": svc.as_utc(session.deadline_at).isoformat(),
        "secondsLeft": max(0, round((svc.as_utc(session.deadline_at) - svc.now_utc()).total_seconds())),
        "result": session.result,
    }


class OAStartIn(BaseModel):
    level: str = Field(default="standard", pattern="^(standard|hard)$")


@router.post("/oa/start", status_code=201)
def start_oa(body: OAStartIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    active = db.scalars(select(CodingSession).where(CodingSession.user_id == user.id,
                                                     CodingSession.status == "active")).all()
    for s in active:
        if svc.now_utc() <= svc.as_utc(s.deadline_at):
            return _session_view(s)
        _finish(db, s)
    recent = set(db.scalars(select(CodingAttempt.slug).where(CodingAttempt.user_id == user.id)
                            .order_by(CodingAttempt.created_at.desc()).limit(40)).all())
    started = svc.now_utc()
    session = CodingSession(user_id=user.id, level=body.level, slugs=svc.pick_oa(body.level, recent),
                            started_at=started, deadline_at=svc.oa_deadline(started))
    db.add(session)
    db.commit()
    return _session_view(session)


@router.get("/oa")
def list_oa(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(CodingSession).where(CodingSession.user_id == user.id)
                      .order_by(CodingSession.started_at.desc()).limit(20)).all()
    return {"sessions": [{"id": s.id, "level": s.level, "status": s.status,
                          "score": (s.result or {}).get("score"),
                          "startedAt": svc.as_utc(s.started_at).isoformat()} for s in rows]}


@router.get("/oa/{session_id}")
def get_oa(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = _own_session(db, user, session_id)
    if session.status == "active" and svc.now_utc() > svc.as_utc(session.deadline_at) + LATE_GRACE:
        _finish(db, session)
    return _session_view(session)


@router.post("/oa/{session_id}/finish")
def finish_oa(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = _own_session(db, user, session_id)
    _finish(db, session)
    return _session_view(session)
