from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..credits import charge
from ..db import get_db
from ..documents import resume_text_from_upload
from ..models import Application, Evidence, User, utcnow
from ..security import current_user
from ..services import applications as svc
from ..services import readiness
from .readiness import create_target_for

router = APIRouter(prefix="/api/applications", tags=["applications"])

MAX_APPLICATIONS = 300
MIN_JD_FOR_PREP = 200
DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


def view(app: Application) -> dict:
    return {
        "id": app.id,
        "company": app.company,
        "title": app.title,
        "jobUrl": app.job_url,
        "jobDescription": app.job_description,
        "location": app.location,
        "salaryNote": app.salary_note,
        "contact": app.contact,
        "notes": app.notes,
        "status": app.status,
        "history": app.status_history or [],
        "nextDate": app.next_date,
        "nextLabel": app.next_label,
        "checklist": svc.checklist(app),
        "prep": app.prep,
        "createdAt": app.created_at.isoformat(),
        "updatedAt": app.updated_at.isoformat(),
    }


def _own(db: Session, user: User, app_id: int) -> Application:
    app = db.get(Application, app_id)
    if app is None or app.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found.")
    return app


class ApplicationIn(BaseModel):
    company: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=120)
    job_url: str = Field(default="", max_length=500)
    job_description: str = Field(default="", max_length=12000)
    location: str = Field(default="", max_length=120)
    salary_note: str = Field(default="", max_length=120)
    contact: str = Field(default="", max_length=200)
    notes: str = Field(default="", max_length=5000)
    status: svc.Status = "saved"
    next_date: str | None = Field(default=None, pattern=DATE_PATTERN)
    next_label: str = Field(default="", max_length=120)


class ApplicationPatch(BaseModel):
    company: str | None = Field(default=None, min_length=1, max_length=120)
    title: str | None = Field(default=None, min_length=1, max_length=120)
    job_url: str | None = Field(default=None, max_length=500)
    job_description: str | None = Field(default=None, max_length=12000)
    location: str | None = Field(default=None, max_length=120)
    salary_note: str | None = Field(default=None, max_length=120)
    contact: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=5000)
    status: svc.Status | None = None
    next_date: str | None = Field(default=None, pattern=DATE_PATTERN)
    clear_next_date: bool = False
    next_label: str | None = Field(default=None, max_length=120)
    checklist: dict[str, bool] | None = None


def _clean_url(url: str) -> str:
    url = url.strip()
    if url and not url.lower().startswith(("http://", "https://")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The job link must start with http:// or https://.")
    return url


@router.get("")
def list_applications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = list(db.scalars(select(Application).where(Application.user_id == user.id)
                           .order_by(Application.updated_at.desc())).all())
    return {"applications": [view(a) for a in rows], "stats": svc.stats(rows, date.today())}


@router.post("", status_code=201)
def create(body: ApplicationIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    count = len(db.scalars(select(Application.id).where(Application.user_id == user.id)).all())
    if count >= MAX_APPLICATIONS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"You can track up to {MAX_APPLICATIONS} applications. "
                            "Delete old ones to continue.")
    data = body.model_dump()
    data["job_url"] = _clean_url(data["job_url"])
    now = utcnow()
    app = Application(user_id=user.id, **{k: v.strip() if isinstance(v, str) else v for k, v in data.items()},
                      status_history=[{"status": body.status, "at": now.isoformat()}], checklist={},
                      created_at=now, updated_at=now)
    db.add(app)
    db.commit()
    return view(app)


@router.get("/{app_id}")
def detail(app_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return view(_own(db, user, app_id))


@router.patch("/{app_id}")
def update(app_id: int, body: ApplicationPatch, user: User = Depends(current_user),
           db: Session = Depends(get_db)):
    app = _own(db, user, app_id)
    now = utcnow()
    for field in ("company", "title", "job_description", "location", "salary_note", "contact", "notes",
                  "next_label", "next_date"):
        value = getattr(body, field)
        if value is not None:
            setattr(app, field, value.strip())
    if body.job_url is not None:
        app.job_url = _clean_url(body.job_url)
    if body.clear_next_date:
        app.next_date = None
    if body.status is not None and body.status != app.status:
        app.status = body.status
        app.status_history = [*(app.status_history or []), {"status": body.status, "at": now.isoformat()}]
    if body.checklist:
        unknown = set(body.checklist) - svc.VALID_CHECKLIST_KEYS
        if unknown:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown checklist item.")
        app.checklist = {**(app.checklist or {}), **body.checklist}
    app.updated_at = now
    db.commit()
    return view(app)


@router.delete("/{app_id}", status_code=204)
def delete(app_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own(db, user, app_id))
    db.commit()
    return Response(status_code=204)


@router.post("/{app_id}/prep-kit")
def prep_kit(app_id: int, response: Response, user: User = Depends(current_user),
             db: Session = Depends(get_db)):
    app = _own(db, user, app_id)
    if len(app.job_description.strip()) < MIN_JD_FOR_PREP:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Add the full job description to this application first.")
    # The user's weakest requirements for their target role sharpen the likely questions.
    target = readiness.active_target(db, user.id)
    rows: list[dict] = []
    if target is not None:
        evidence = list(db.scalars(select(Evidence).where(Evidence.user_id == user.id,
                                                          Evidence.target_role_id == target.id)).all())
        rows = readiness.compute_readiness(target, evidence)["requirements"]
    gaps = [r["name"] for r in rows if r["score"] is None or r["score"] < 60][:8]

    with charge(db, user, "prep_kit", response):
        kit = svc.prep_kit(app, gaps, user.id)

    # Attach what we already know about the candidate for each focus skill.
    for skill in kit["focusSkills"]:
        key = readiness.match_requirement(target, skill["skill"])
        row = next((r for r in rows if r["key"] == key), None)
        skill["yourScore"] = row["score"] if row else None
    kit["generatedAt"] = utcnow().isoformat()
    app.prep = kit
    app.checklist = {**(app.checklist or {}), "prep_kit": True}
    app.updated_at = utcnow()
    db.commit()
    return view(app)


@router.post("/{app_id}/make-target")
def make_target(app_id: int, response: Response, resume: UploadFile | None = File(default=None),
                user: User = Depends(current_user), db: Session = Depends(get_db)):
    app = _own(db, user, app_id)
    if len(app.job_description.strip()) < MIN_JD_FOR_PREP:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Add the full job description to this application first.")
    resume_text = resume_text_from_upload(resume) if resume is not None and resume.filename else ""
    target = create_target_for(db, user, response, app.title, app.job_description, resume_text)
    app.checklist = {**(app.checklist or {}), "make_target": True}
    app.updated_at = utcnow()
    db.commit()
    return {"application": view(app), "target": readiness.target_to_dict(target)}
