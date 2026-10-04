from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from sqlalchemy.orm import Session

from ..credits import charge
from ..db import get_db
from ..documents import resume_text_from_upload
from ..models import User
from ..security import current_user
from ..services import readiness
from ..services import resume as svc

router = APIRouter(prefix="/api/resume", tags=["resume"])


@router.post("/skills")
def extract_skills(response: Response, resume: UploadFile = File(...),
                         user: User = Depends(current_user), db: Session = Depends(get_db)):
    text = resume_text_from_upload(resume)  # validate before charging
    with charge(db, user, "resume_skills", response):
        result = svc.extract_skills(text, user.id)
    return {"techStack": result.skills, "category": result.category,
            "primaryRole": result.primary_role, "seniority": result.seniority}


@router.post("/analyze")
def analyze(response: Response, resume: UploadFile = File(...),
                  target_role: str = Form(default="", max_length=120),
                  job_description: str = Form(default="", max_length=12000),
                  use_target: bool = Form(default=False),
                  user: User = Depends(current_user), db: Session = Depends(get_db)):
    text = resume_text_from_upload(resume)
    target = readiness.active_target(db, user.id) if use_target else None
    if target is not None:
        # Analyse against the user's target role unless they supplied something more specific.
        target_role = target_role.strip() or target.title
        job_description = job_description.strip() or target.job_description
    with charge(db, user, "resume_analysis", response):
        result = svc.analyze_resume(text, target_role.strip(), job_description.strip(), user.id)
    if target is not None:
        readiness.record_resume(db, user.id, target, text, result["overall_score"])
        result["targetRole"] = {"id": target.id, "title": target.title}
    return result
