from __future__ import annotations

import hmac

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..services import reminders
from ..services.learning import now_utc

router = APIRouter(prefix="/api/internal/cron", include_in_schema=False)


@router.post("/reminders")
async def run_reminders(request: Request, db: Session = Depends(get_db)) -> dict:
    """Call hourly from any cron service with `Authorization: Bearer <CRON_SECRET>`."""
    settings = get_settings()
    if not settings.cron_secret or (settings.is_production and not settings.email_enabled):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Reminders are not configured.")
    given = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    if not hmac.compare_digest(given, settings.cron_secret):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid cron secret.")
    return await run_in_threadpool(reminders.run, db, now_utc())
