"""Account deletion: keep payment records detached (user_id NULL), and remember which inboxes got
the signup bonus (as hashes) so deleting and signing up again does not earn it twice.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-06
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def _bonus_hash(canonical: str) -> str:
    # A frozen copy of services.signup.bonus_hash.
    return hashlib.sha256(f"signup-bonus:{canonical}".encode()).hexdigest()


def upgrade() -> None:
    with op.batch_alter_table("payments", schema=None) as batch_op:
        batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=True)

    claims = op.create_table(
        "signup_bonus_claims",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email_hash"),
    )
    users = sa.table("users", sa.column("email_canonical", sa.String), sa.column("signup_bonus", sa.Boolean))
    inboxes = {row.email_canonical for row in op.get_bind().execute(
        sa.select(users.c.email_canonical).where(users.c.signup_bonus.is_(True)))}
    now = datetime.now(timezone.utc)
    if inboxes:
        op.bulk_insert(claims, [{"email_hash": _bonus_hash(i), "created_at": now} for i in sorted(inboxes)])


def downgrade() -> None:
    op.drop_table("signup_bonus_claims")
    op.execute("DELETE FROM payments WHERE user_id IS NULL")
    with op.batch_alter_table("payments", schema=None) as batch_op:
        batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=False)
