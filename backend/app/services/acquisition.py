"""Which campaigns bring signups, verified users and paying customers (for ad spend decisions).

    python -m app.jobs acquisition [days]
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Payment, User


def _source(user: User) -> str:
    a = user.acquisition or {}
    if a.get("utm_source"):
        return a["utm_source"] + (f" / {a['utm_campaign']}" if a.get("utm_campaign") else "")
    for click, name in (("gclid", "google ads"), ("gbraid", "google ads"), ("wbraid", "google ads"),
                        ("fbclid", "meta"), ("msclkid", "microsoft ads"), ("ttclid", "tiktok")):
        if a.get(click):
            return f"{name} (no utm)"
    if a.get("referrer"):
        host = a["referrer"].split("//", 1)[-1].split("/", 1)[0].removeprefix("www.")
        return f"referral: {host}"
    return "direct / unknown"


def report(db: Session, now: datetime, days: int = 30) -> list[dict]:
    """Signups in the window, grouped by source, with conversion to verified and paying."""
    since = now - timedelta(days=days)
    users = db.scalars(select(User).where(User.created_at >= since)).all()
    paid: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    ids = [u.id for u in users]
    if ids:
        for p in db.scalars(select(Payment).where(Payment.user_id.in_(ids))):
            paid[p.user_id][p.currency] += p.amount_cents
    rows: dict[str, dict] = {}
    for u in users:
        row = rows.setdefault(_source(u), {"source": _source(u), "signups": 0, "verified": 0, "buyers": 0,
                                           "revenue": defaultdict(int)})
        row["signups"] += 1
        row["verified"] += u.email_verified_at is not None
        if u.id in paid:
            row["buyers"] += 1
            for currency, cents in paid[u.id].items():
                row["revenue"][currency] += cents
    out = sorted(rows.values(), key=lambda r: (-r["buyers"], -r["signups"], r["source"]))
    for r in out:
        r["revenue"] = {c: round(v / 100, 2) for c, v in sorted(r["revenue"].items())}
    return out
