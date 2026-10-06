"""Database migrations (Alembic), run automatically at startup.

    python -m app.migrate                      # upgrade to the latest schema
    python -m app.migrate current              # show the database's revision
    python -m app.migrate revision "add x"     # autogenerate a migration from model changes

Databases created before migrations existed (tables made by `create_all`) are upgraded in place:
the baseline revision only creates the tables that are missing.
"""

from __future__ import annotations

import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy import Engine, text

from .db import engine as default_engine

MIGRATIONS = Path(__file__).resolve().parent / "migrations"
# Any constant works; it only has to be the same in every process that runs migrations.
_PG_LOCK_ID = 7_310_524_901


def _config() -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", str(MIGRATIONS))
    return cfg


def upgrade(engine: Engine | None = None, revision: str = "head") -> None:
    """Bring the schema up to date. Safe to call from several workers at once."""
    engine = engine or default_engine
    cfg = _config()
    with engine.begin() as conn:
        postgres = conn.dialect.name == "postgresql"
        if postgres:
            # Workers start together; the first one migrates while the others wait, then find nothing to do.
            conn.execute(text("SELECT pg_advisory_xact_lock(:id)"), {"id": _PG_LOCK_ID})
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, revision)


def current_revision(engine: Engine | None = None) -> str | None:
    with (engine or default_engine).connect() as conn:
        return MigrationContext.configure(conn).get_current_revision()


def main(argv: list[str]) -> int:
    action = argv[1] if len(argv) > 1 else "upgrade"
    if action == "upgrade":
        upgrade()
        print(f"Database is at revision {current_revision()}")
        return 0
    if action == "current":
        print(current_revision() or "(empty database)")
        return 0
    if action == "revision" and len(argv) > 2:
        cfg = _config()
        with default_engine.begin() as conn:
            cfg.attributes["connection"] = conn
            command.revision(cfg, message=argv[2], autogenerate=True)
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
