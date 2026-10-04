from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from ..config import get_settings
from ..credits import charge
from ..db import get_db
from ..documents import extract_text, read_upload
from ..models import User
from ..security import current_user
from ..services.job_match import match_resume

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/job-match", tags=["job-match"])


@router.post("/analyze")
def analyze(response: Response, resumes: list[UploadFile] = File(...),
                  job_description: str = Form(..., min_length=50, max_length=12000),
                  user: User = Depends(current_user), db: Session = Depends(get_db)):
    settings = get_settings()
    if len(resumes) > settings.max_job_match_resumes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Upload at most {settings.max_job_match_resumes} resumes at a time.")
    # Parse everything up front so invalid files fail fast and are never charged.
    parsed = []
    for f in resumes:
        parsed.append((f.filename or "resume", extract_text(f.filename or "", read_upload(f))))

    jd = job_description.strip()
    results, errors = [], []
    with charge(db, user, "job_match_per_resume", response, quantity=len(parsed)) as handle:
        def run(item):
            name, text = item
            try:
                return match_resume(name, text, jd, user.id), None
            except Exception as exc:  # one bad resume must not fail the batch
                log.warning("job match failed for %s: %s", name, exc)
                return None, name

        with ThreadPoolExecutor(max_workers=4) as pool:
            for result, failed in pool.map(run, parsed):
                if result:
                    results.append(result)
                else:
                    errors.append(failed)
        if not results:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                                "Analysis failed for all resumes. You were not charged.")
        handle.refund_units(len(errors))

    results.sort(key=lambda r: r["match_percentage"], reverse=True)
    return {"results": results, "failed": errors}
