"""The migrations must build exactly the schema the models describe, from empty or legacy databases."""

from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text

from app import migrate
from app.db import Base
from app.models import SignupBonusClaim, User
from app.services.signup import bonus_hash


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
    """A pre-migrations database: baseline-era tables made by create_all, some missing, no version."""
    engine = _engine(tmp_path, "legacy.db")
    migrate.upgrade(engine, "0001")
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE alembic_version"))
        conn.execute(text("DROP TABLE email_logs"))  # e.g. made before Phase 5
        conn.execute(text("INSERT INTO users (email, name, password_hash, credits, created_at) "
                          "VALUES ('Old.Name+x@Gmail.com', 'Old', 'x', 7, '2026-01-01 00:00:00')"))
    migrate.upgrade(engine)
    assert _diff(engine) == []
    assert set(Base.metadata.tables) <= set(inspect(engine).get_table_names())
    with engine.connect() as conn:
        old = conn.execute(User.__table__.select()).one()
    # Existing users already had their free credits: verified, bonus used, credits untouched.
    assert old.credits == 7 and old.signup_bonus and old.email_verified_at is not None
    assert old.email_canonical == "oldname@gmail.com"
    with engine.connect() as conn:
        claim = conn.execute(SignupBonusClaim.__table__.select()).one()
    assert claim.email_hash == bonus_hash("oldname@gmail.com")
