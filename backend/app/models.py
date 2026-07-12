import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ContextTag(str, enum.Enum):
    MORNING = "morning"
    PRE_WORK = "pre_work"
    POST_WORK = "post_work"
    PRE_SLEEP = "pre_sleep"
    OTHER = "other"


class TaskType(str, enum.Enum):
    PVT = "pvt"
    NBACK = "nback"
    STROOP = "stroop"


class ErrorType(str, enum.Enum):
    INTERFERENCE = "interference"
    RANDOM = "random"
    # "none" means the trial was incorrect but the error wasn't further categorized
    # (e.g., a raw PVT lapse has no error type). Distinct from NULL, which means
    # the field wasn't applicable at all.
    NONE = "none"


class Session(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        # KSS is a validated 1–9 scale; enforce range at the DB level so no
        # out-of-range values can enter even if the application layer skips validation.
        CheckConstraint("kss_pre IS NULL OR (kss_pre >= 1 AND kss_pre <= 9)", name="ck_kss_pre_range"),
        CheckConstraint("kss_post IS NULL OR (kss_post >= 1 AND kss_post <= 9)", name="ck_kss_post_range"),
    )

    # UUID primary key: prevents sequential ID enumeration from the public API.
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    # Server-assigned timestamp: prevents client-side clock drift or manipulation
    # from corrupting the session ordering that the model will rely on.
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    # values_callable tells SQLAlchemy to use the enum's .value ('morning') not its .name ('MORNING')
    # when communicating with the DB — the PostgreSQL enum was created with lowercase values.
    context_tag: Mapped[ContextTag] = mapped_column(SAEnum(ContextTag, name="contexttag", values_callable=lambda e: [x.value for x in e]), nullable=False)
    kss_pre: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    kss_post: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sleep_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    hours_since_waking: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    trials: Mapped[list["Trial"]] = relationship(
        "Trial", back_populates="session", cascade="all, delete-orphan"
    )


class Trial(Base):
    __tablename__ = "trials"
    __table_args__ = (
        # error_type is only meaningful on incorrect trials. This constraint prevents
        # logically inconsistent rows (e.g., a correct trial marked with an error classification).
        CheckConstraint("error_type IS NULL OR accuracy = FALSE", name="ck_error_type_only_on_incorrect"),
    )

    trial_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.session_id", ondelete="CASCADE"),
        nullable=False,
    )
    task_type: Mapped[TaskType] = mapped_column(SAEnum(TaskType, name="tasktype", values_callable=lambda e: [x.value for x in e]), nullable=False)
    trial_number: Mapped[int] = mapped_column(Integer, nullable=False)
    # Nullable to represent missed/lapse trials in PVT, where no response is given
    # and therefore no reaction time exists (not zero — absence of response is distinct from slow response).
    reaction_time_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    accuracy: Mapped[bool] = mapped_column(Boolean, nullable=False)
    error_type: Mapped[Optional[ErrorType]] = mapped_column(SAEnum(ErrorType, name="errortype", values_callable=lambda e: [x.value for x in e]), nullable=True)
    # Reserved for Phase 3 response-dynamics features (mouse trajectory, keypress dwell time).
    # Stored as JSONB so the schema doesn't need to change when we start capturing it.
    raw_response: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    session: Mapped["Session"] = relationship("Session", back_populates="trials")
