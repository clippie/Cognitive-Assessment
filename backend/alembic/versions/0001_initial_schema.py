"""Initial schema: sessions and trials tables with pgvector extension

Revision ID: 0001
Revises:
Create Date: 2026-07-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector now so it exists in migration history from the start.
    # The extension is unused in Phase 1 but must be present before we add
    # vector columns in a later migration — enabling it here keeps the history coherent
    # and avoids a migration ordering problem down the line.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # DB-level enum types enforce the allowed values at the storage layer,
    # not just the application layer. This means even direct SQL inserts
    # (e.g., a future data-repair script) can't introduce invalid values.
    op.execute("CREATE TYPE contexttag AS ENUM ('morning', 'pre_work', 'post_work', 'pre_sleep', 'other')")
    op.execute("CREATE TYPE tasktype AS ENUM ('pvt', 'nback', 'stroop')")
    op.execute("CREATE TYPE errortype AS ENUM ('interference', 'random', 'none')")

    op.create_table(
        "sessions",
        sa.Column("session_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("context_tag", sa.Enum("morning", "pre_work", "post_work", "pre_sleep", "other", name="contexttag"), nullable=False),
        sa.Column("kss_pre", sa.Integer(), nullable=True),
        sa.Column("kss_post", sa.Integer(), nullable=True),
        sa.Column("sleep_hours", sa.Float(), nullable=True),
        sa.Column("hours_since_waking", sa.Float(), nullable=True),
        sa.CheckConstraint("kss_pre IS NULL OR (kss_pre >= 1 AND kss_pre <= 9)", name="ck_kss_pre_range"),
        sa.CheckConstraint("kss_post IS NULL OR (kss_post >= 1 AND kss_post <= 9)", name="ck_kss_post_range"),
    )

    op.create_table(
        "trials",
        sa.Column("trial_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_type", sa.Enum("pvt", "nback", "stroop", name="tasktype"), nullable=False),
        sa.Column("trial_number", sa.Integer(), nullable=False),
        sa.Column("reaction_time_ms", sa.Float(), nullable=True),
        sa.Column("accuracy", sa.Boolean(), nullable=False),
        sa.Column("error_type", sa.Enum("interference", "random", "none", name="errortype"), nullable=True),
        sa.Column("raw_response", postgresql.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.session_id"], ondelete="CASCADE"),
        # Prevents logically inconsistent rows: a correct trial cannot have an error classification.
        sa.CheckConstraint("error_type IS NULL OR accuracy = FALSE", name="ck_error_type_only_on_incorrect"),
    )


def downgrade() -> None:
    op.drop_table("trials")
    op.drop_table("sessions")
    op.execute("DROP TYPE IF EXISTS errortype")
    op.execute("DROP TYPE IF EXISTS tasktype")
    op.execute("DROP TYPE IF EXISTS contexttag")
    # Intentionally NOT dropping the vector extension on downgrade:
    # other DB objects (e.g., from other migrations) may depend on it,
    # and dropping an extension is a destructive action that should be manual.
