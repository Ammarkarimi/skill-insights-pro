"""Record the buyer's request for immediate supply (and loss of the cancellation right) on payments.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("payments", schema=None) as batch_op:
        batch_op.add_column(sa.Column("supply_consent", sa.Boolean(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("payments", schema=None) as batch_op:
        batch_op.drop_column("supply_consent")
