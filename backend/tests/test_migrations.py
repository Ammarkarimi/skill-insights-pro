"""The migrations must build exactly the schema the models describe, from empty or legacy databases."""

from datetime import datetime, timezone

from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, inspect

from app import migrate
from app.db import Base
from app.models import User


def _engine(tmp_path, name="m.db"):
    return create_engine(f"sqlite:///{tmp_path / name}")


def _diff(engine):
    with engine.connect() as conn:
        return compare_metadata(MigrationContext.configure(conn), Base.metadata)


def test_migrations_match_the_models(tmp_path):
    engine = _engine(tmp_path)
    migrate.upgrade(engine)
    assert _diff(engine) == [], "models changed without a migration: run `python -m app.migrate revision`"
    assert migrate.current_revision(engine) is not None
    migrate.upgrade(engine)  # running again is a no-op


def test_legacy_create_all_database_is_adopted(tmp_path):
    """A database made by create_all before migrations existed, missing some tables."""
    engine = _engine(tmp_path, "legacy.db")
    Base.metadata.tables["users"].create(engine)
    with engine.begin() as conn:
        conn.execute(User.__table__.insert().values(
            email="old@example.com", name="Old", password_hash="x", credits=7,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc)))
    migrate.upgrade(engine)
    assert _diff(engine) == []
    assert set(Base.metadata.tables) <= set(inspect(engine).get_table_names())
    with engine.connect() as conn:
        assert conn.execute(User.__table__.select()).one().credits == 7
