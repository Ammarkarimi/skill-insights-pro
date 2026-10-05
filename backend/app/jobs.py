"""Scheduled jobs for hosts with built-in cron (Render Cron Jobs, Railway, a VPS crontab).

    python -m app.jobs reminders     # run hourly
"""

from __future__ import annotations

import json
import logging
import sys

from .db import SessionLocal, init_db
from .services import reminders
from .services.learning import now_utc


def main(argv: list[str]) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    if argv[1:] != ["reminders"]:
        print("usage: python -m app.jobs reminders", file=sys.stderr)
        return 2
    init_db()
    with SessionLocal() as db:
        print(json.dumps(reminders.run(db, now_utc())))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
