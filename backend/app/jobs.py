"""Scheduled jobs and reports for hosts with built-in cron (Render Cron Jobs, Railway, a VPS crontab).

    python -m app.jobs reminders            # run hourly
    python -m app.jobs acquisition [days]   # signups and buyers by campaign (default: 30 days)
"""

from __future__ import annotations

import json
import logging
import sys

from .db import SessionLocal, init_db
from .services import acquisition, reminders
from .services.learning import now_utc

USAGE = "usage: python -m app.jobs reminders | acquisition [days]"


def main(argv: list[str]) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    args = argv[1:]
    if args == ["reminders"]:
        init_db()
        with SessionLocal() as db:
            print(json.dumps(reminders.run(db, now_utc())))
        return 0
    if args[:1] == ["acquisition"] and len(args) <= 2 and (len(args) == 1 or args[1].isdigit()):
        init_db()
        with SessionLocal() as db:
            rows = acquisition.report(db, now_utc(), int(args[1]) if len(args) == 2 else 30)
        print(json.dumps(rows, indent=2))
        return 0
    print(USAGE, file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
