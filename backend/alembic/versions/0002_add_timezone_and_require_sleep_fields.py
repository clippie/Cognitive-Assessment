"""Add mandatory timezone field; make sleep_hours/hours_since_waking mandatory

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # As of this migration, timezone/sleep_hours/hours_since_waking are mandatory
    # on every session, but 2 real sessions already exist in prod from before this
    # field set was decided. Backfilling fabricated values for real collected data
    # would corrupt the dataset the model trains on, and per project decision
    # (2026-07-16) it's early enough in collection that deleting these 2 rows is
    # preferable to inventing values for them. ON DELETE CASCADE on trials.session_id
    # (see 0001) removes their trials along with them.
    op.execute("DELETE FROM sessions")

    timezone_enum = postgresql.ENUM("EST", "CST", "MST", "PST", name="usertimezone")
    timezone_enum.create(op.get_bind())

    op.add_column(
        "sessions",
        sa.Column(
            "timezone",
            sa.Enum("EST", "CST", "MST", "PST", name="usertimezone", create_type=False),
            nullable=False,
        ),
    )
    op.alter_column("sessions", "sleep_hours", existing_type=sa.Float(), nullable=False)
    op.alter_column("sessions", "hours_since_waking", existing_type=sa.Float(), nullable=False)


def downgrade() -> None:
    op.alter_column("sessions", "hours_since_waking", existing_type=sa.Float(), nullable=True)
    op.alter_column("sessions", "sleep_hours", existing_type=sa.Float(), nullable=True)
    op.drop_column("sessions", "timezone")
    op.execute("DROP TYPE IF EXISTS usertimezone")
