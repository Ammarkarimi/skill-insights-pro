from __future__ import annotations

import json
import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..credits import charge
from ..db import get_db
from ..documents import resume_text_from_upload
from ..models import TailoredResume, User, utcnow
from ..security import current_user
from ..services import exporters, readiness
from ..services import tailor as svc

router = APIRouter(prefix="/api/tailor", tags=["tailor"])

MAX_SAVED = 50
_PLACEHOLDER = re.compile(r"\[[^\]]{1,30}\]")


def _placeholders(content: svc.ResumeContent) -> int:
    texts = [content.summary] + [b for r in content.experience for b in r.bullets] + \
            [b for p in content.projects for b in p.bullets]
    return sum(len(_PLACEHOLDER.findall(t)) for t in texts)


def _view(row: TailoredResume) -> dict:
    content = svc.ResumeContent.model_validate(row.content)
    return {
        "id": row.id,
        "jobTitle": row.job_title,
        "company": row.company,
        "content": row.content,
        "changes": row.meta.get("changes", []),
        "keywordsAdded": row.meta.get("keywords_added", []),
        "keywordsMissing": row.meta.get("keywords_missing", []),
        "warnings": svc.warnings_for(row.meta.get("facts", {}), content),
        "placeholders": _placeholders(content),
        "createdAt": row.created_at.isoformat(),
        "updatedAt": row.updated_at.isoformat(),
    }


def _own(db: Session, user: User, resume_id: int) -> TailoredResume:
    row = db.get(TailoredResume, resume_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tailored resume not found.")
    return row


@router.post("", status_code=201)
def create(response: Response, resume: UploadFile = File(...),
           job_description: str = Form(default="", max_length=12000),
           job_title: str = Form(default="", max_length=120),
           company: str = Form(default="", max_length=120),
           use_target: bool = Form(default=False),
           user: User = Depends(current_user), db: Session = Depends(get_db)):
    text = resume_text_from_upload(resume)
    target = readiness.active_target(db, user.id) if use_target else None
    jd = job_description.strip() or (target.job_description if target else "")
    title = job_title.strip() or (target.title if target else "")
    if len(jd) < 50:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Paste the job description (at least 50 characters) to tailor your resume.")
    count = len(db.scalars(select(TailoredResume.id).where(TailoredResume.user_id == user.id)).all())
    if count >= MAX_SAVED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"You can keep up to {MAX_SAVED} tailored resumes. Delete some to continue.")

    with charge(db, user, "resume_tailor", response):
        result = svc.tailor(text, title, company.strip(), jd, user.id)
    facts = svc.source_facts(text, result.resume)
    row = TailoredResume(
        user_id=user.id, target_role_id=target.id if target else None, job_title=title,
        company=company.strip(), job_description=jd, content=result.resume.model_dump(),
        meta={"changes": [c.model_dump() for c in result.changes],
              "keywords_added": result.keywords_added, "keywords_missing": result.keywords_missing,
              "facts": facts},
    )
    db.add(row)
    db.commit()
    return _view(row)


@router.get("")
def list_saved(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(TailoredResume).where(TailoredResume.user_id == user.id)
                      .order_by(TailoredResume.updated_at.desc())).all()
    return {"resumes": [{"id": r.id, "jobTitle": r.job_title, "company": r.company,
                         "updatedAt": r.updated_at.isoformat()} for r in rows]}


@router.get("/{resume_id}")
def get_one(resume_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _view(_own(db, user, resume_id))


@router.put("/{resume_id}")
def update(resume_id: int, content: svc.ResumeContent, user: User = Depends(current_user),
           db: Session = Depends(get_db)):
    row = _own(db, user, resume_id)
    data = content.model_dump()
    if len(json.dumps(data)) > 60_000:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This resume is too long.")
    row.content = data
    row.updated_at = utcnow()
    db.commit()
    return _view(row)


@router.delete("/{resume_id}", status_code=204)
def delete(resume_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own(db, user, resume_id))
    db.commit()
    return Response(status_code=204)


@router.get("/{resume_id}/export")
def export(resume_id: int, format: str = Query("docx", pattern="^(docx|pdf)$"),
           user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = _own(db, user, resume_id)
    content = svc.ResumeContent.model_validate(row.content)
    stem = re.sub(r"[^A-Za-z0-9]+", "_", f"{content.contact.name or 'resume'} {row.job_title}").strip("_")
    if format == "pdf":
        data, media = exporters.resume_pdf(content), "application/pdf"
    else:
        data = exporters.resume_docx(content)
        media = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return Response(data, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{stem or "resume"}.{format}"'})
