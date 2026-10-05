from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..credits import charge
from ..db import get_db
from ..documents import resume_text_from_upload
from ..models import Evidence, TargetRole, User
from ..security import current_user
from ..services import readiness as svc

router = APIRouter(prefix="/api/readiness", tags=["readiness"])

MAX_TARGETS = 20


def create_target_for(db: Session, user: User, response: Response, title: str, job_description: str,
                      resume_text: str) -> TargetRole:
    """Charge, extract the requirement map, record baseline evidence and make it the active target."""
    count = len(db.scalars(select(TargetRole.id).where(TargetRole.user_id == user.id)).all())
    if count >= MAX_TARGETS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"You can keep up to {MAX_TARGETS} target roles.")
    with charge(db, user, "target_role_setup", response):
        summary, requirements, baseline = svc.extract_requirements(
            title, job_description, resume_text, user.id)

    target = TargetRole(user_id=user.id, title=title, job_description=job_description,
                        summary=summary, requirements=requirements)
    db.add(target)
    db.flush()
    svc.activate(db, target)
    names = {r["key"]: r["name"] for r in requirements}
    for key, info in baseline.items():
        svc.record_evidence(db, user.id, "baseline", names[key], svc.BASELINE_SCORES[info["status"]],
                            payload=info, target=target, requirement_key=key, commit=False)
    db.commit()
    return target


@router.post("/targets", status_code=201)
def create_target(response: Response,
                  title: str = Form(..., min_length=2, max_length=120),
                  job_description: str = Form(default="", max_length=12000),
                  resume: UploadFile | None = File(default=None),
                  user: User = Depends(current_user), db: Session = Depends(get_db)):
    # Validate the upload before charging.
    resume_text = resume_text_from_upload(resume) if resume is not None and resume.filename else ""
    target = create_target_for(db, user, response, title.strip(), job_description.strip(), resume_text)
    return svc.target_to_dict(target)


@router.get("/targets")
def list_targets(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(TargetRole).where(TargetRole.user_id == user.id)
                      .order_by(TargetRole.created_at.desc())).all()
    return {"targets": [svc.target_to_dict(t) for t in rows]}


@router.post("/targets/{target_id}/activate")
def activate_target(target_id: int, user: User = Depends(current_user),
                    db: Session = Depends(get_db)):
    target = db.get(TargetRole, target_id)
    if target is None or target.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Target role not found.")
    svc.activate(db, target)
    return svc.target_to_dict(target)


@router.get("")
def readiness(user: User = Depends(current_user), db: Session = Depends(get_db)):
    target = svc.active_target(db, user.id)
    if target is None:
        return {"target": None}
    evidence = db.scalars(select(Evidence).where(Evidence.user_id == user.id,
                                                 Evidence.target_role_id == target.id)).all()
    computed = svc.compute_readiness(target, list(evidence))
    return {
        "target": svc.target_to_dict(target),
        **computed,
        "actions": svc.next_actions(target, computed, list(evidence)),
        "sourceLabels": svc.SOURCE_LABELS,
    }
