from __future__ import annotations

import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..credits import charge
from ..db import get_db
from ..documents import resume_text_from_upload
from ..models import TailoredResume, User
from ..security import current_user
from ..services import exporters, readiness, tailor
from ..services import letters as svc

router = APIRouter(prefix="/api/letters", tags=["letters"])


@router.post("")
def create(response: Response,
           kind: svc.LetterType = Form(...),
           tone: svc.Tone = Form(default="professional"),
           job_title: str = Form(default="", max_length=120),
           company: str = Form(default="", max_length=120),
           job_description: str = Form(default="", max_length=12000),
           recipient_name: str = Form(default="", max_length=120),
           notes: str = Form(default="", max_length=1500),
           tailored_id: int | None = Form(default=None),
           use_target: bool = Form(default=False),
           resume: UploadFile | None = File(default=None),
           user: User = Depends(current_user), db: Session = Depends(get_db)):
    # Source material: a saved tailored resume, or an uploaded one. Validated before charging.
    if tailored_id is not None:
        row = db.get(TailoredResume, tailored_id)
        if row is None or row.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Tailored resume not found.")
        content = tailor.ResumeContent.model_validate(row.content)
        resume_text = tailor.content_to_text(content)
        known = set(row.meta.get("facts", {}).get("numbers", [])) | tailor.figures(resume_text)
        job_title = job_title or row.job_title
        company = company or row.company
        job_description = job_description or row.job_description
    elif resume is not None and resume.filename:
        resume_text = resume_text_from_upload(resume)
        known = tailor.figures(resume_text)
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose a tailored resume or upload your resume.")

    if use_target:
        target = readiness.active_target(db, user.id)
        if target is not None:
            job_title = job_title or target.title
            job_description = job_description or target.job_description
    if kind == "thank_you" and not notes.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Add a few notes about the interview so the thank-you can be specific.")

    with charge(db, user, "letter", response):
        result = svc.write(kind, tone, resume_text, job_title.strip(), company.strip(),
                           job_description.strip(), recipient_name.strip(), notes.strip(), user.id)
    result["warnings"] = tailor.new_figure_warnings(known, [result["body"]])
    return result


class ExportIn(BaseModel):
    subject: str = Field(default="", max_length=200)
    body: str = Field(min_length=1, max_length=8000)
    filename: str = Field(default="letter", max_length=80)


@router.post("/export")
def export(body: ExportIn, user: User = Depends(current_user)):
    stem = re.sub(r"[^A-Za-z0-9]+", "_", body.filename).strip("_") or "letter"
    return Response(
        exporters.letter_docx(body.body, body.subject),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{stem}.docx"'},
    )
