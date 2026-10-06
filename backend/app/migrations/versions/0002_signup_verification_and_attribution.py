"""Signup verification and attribution.

Users who signed up before verification existed already received their free credits, so they are
marked verified with the bonus granted.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def _canonical(email: str) -> str:
    # A frozen copy of services.signup.canonical_email, so this migration never changes meaning.
    local, _, domain = email.strip().lower().partition("@")
    local = local.split("+", 1)[0]
    if domain in ("gmail.com", "googlemail.com"):
        local, domain = local.replace(".", ""), "gmail.com"
    return f"{local}@{domain}"


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("email_canonical", sa.String(length=320), nullable=False,
                                      server_default=""))
        batch_op.add_column(sa.Column("signup_bonus", sa.Boolean(), nullable=False,
                                      server_default=sa.false()))
        batch_op.add_column(sa.Column("acquisition", sa.JSON(), nullable=True))
        batch_op.create_index(batch_op.f("ix_users_email_canonical"), ["email_canonical"], unique=False)

    users = sa.table("users", sa.column("id", sa.Integer), sa.column("email", sa.String),
                     sa.column("created_at", sa.DateTime(timezone=True)),
                     sa.column("email_verified_at", sa.DateTime(timezone=True)),
                     sa.column("email_canonical", sa.String), sa.column("signup_bonus", sa.Boolean))
    conn = op.get_bind()
    for row in conn.execute(sa.select(users.c.id, users.c.email, users.c.created_at)).all():
        conn.execute(users.update().where(users.c.id == row.id).values(
            email_verified_at=row.created_at, email_canonical=_canonical(row.email), signup_bonus=True))


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_users_email_canonical"))
        batch_op.drop_column("acquisition")
        batch_op.drop_column("signup_bonus")
        batch_op.drop_column("email_canonical")
        batch_op.drop_column("email_verified_at")
