"""In-process hourly job runner (reminder emails), for hosts without a separate cron service.

Safe with several instances: each reminder is claimed with a unique EmailLog row before it is sent,
so overlapping runs cannot send twice. Turn it off with RUN_SCHEDULER=false if an external cron calls
POST /api/internal/cron/reminders or `python -m app.jobs reminders` instead.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from fastapi.concurrency import run_in_threadpool

from .db import SessionLocal
from .services import reminders

log = logging.getLogger(__name__)
RUN_AT_MINUTE = 7  # a few minutes past the hour, away from everyone else's :00 jobs


def seconds_until_next_run(now: datetime, minute: int = RUN_AT_MINUTE) -> float:
    target = now.replace(minute=minute, second=0, microsecond=0)
    if target <= now:
        target += timedelta(hours=1)
    return (target - now).total_seconds()


def _run_once() -> dict:
    with SessionLocal() as db:
        return reminders.run(db, datetime.now(timezone.utc))


async def loop() -> None:
    while True:
        await asyncio.sleep(seconds_until_next_run(datetime.now(timezone.utc)))
        try:
            await run_in_threadpool(_run_once)
        except Exception:  # never let one bad run stop the loop
            log.exception("Scheduled reminders run failed")
