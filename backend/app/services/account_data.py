"""Data export and account deletion (UK GDPR, EU GDPR, Australian Privacy Act, India DPDP).

Every table with a `user_id` column is covered automatically, so new features are included without
changes here. Payment records are kept for tax and accounting law, detached from the person.
"""

from __future__ import annotations

import logging
from datetime import date, datetime

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from ..db import Base
from ..models import Payment, User, utcnow

log = logging.getLogger(__name__)

# Never exported: secrets and internal bookkeeping.
PRIVATE_COLUMNS = {"users": {"password_hash", "email_canonical"}}
KEEP_DETACHED = {Payment.__tablename__}


def _user_tables():
    return [t for t in Base.metadata.sorted_tables if "user_id" in t.c]


def _json(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _rows(db: Session, table, where) -> list[dict]:
    hidden = PRIVATE_COLUMNS.get(table.name, set())
    return [{k: _json(v) for k, v in row._mapping.items() if k not in hidden}
            for row in db.execute(select(table).where(where))]


def export_data(db: Session, user: User) -> dict:
    users = Base.metadata.tables["users"]
    data = {"exportedAt": utcnow().isoformat(), "account": _rows(db, users, users.c.id == user.id)[0]}
    for table in _user_tables():
        rows = _rows(db, table, table.c.user_id == user.id)
        if rows:
            data[table.name] = rows
    return data


def delete_account(db: Session, user: User) -> None:
    """Delete everything about the user. Children first, so foreign keys never block."""
    user_id = user.id
    for table in reversed(_user_tables()):
        if table.name in KEEP_DETACHED:
            db.execute(update(table).where(table.c.user_id == user_id).values(user_id=None))
        else:
            db.execute(delete(table).where(table.c.user_id == user_id))
    db.execute(delete(Base.metadata.tables["users"]).where(Base.metadata.tables["users"].c.id == user_id))
    db.commit()
    log.info("Deleted account %s", user_id)
