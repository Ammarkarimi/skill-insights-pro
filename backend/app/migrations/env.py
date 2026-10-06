"""Alembic environment. Migrations run from `app.migrate` (at startup or `python -m app.migrate`)."""

from __future__ import annotations

from alembic import context

from app import models  # noqa: F401  (register tables)
from app.db import Base

config = context.config
connection = config.attributes["connection"]

context.configure(
    connection=connection,
    target_metadata=Base.metadata,
    render_as_batch=True,  # SQLite cannot ALTER most columns; batch mode copies the table instead
    compare_type=True,
)
with context.begin_transaction():
    context.run_migrations()
