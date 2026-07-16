import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from app.models import ContextTag, ErrorType, TaskType, TimeZone


class TrialCreate(BaseModel):
    task_type: TaskType
    trial_number: int = Field(ge=1)
    reaction_time_ms: Optional[float] = Field(None, gt=0)
    accuracy: bool
    error_type: Optional[ErrorType] = None
    raw_response: Optional[dict] = None

    @model_validator(mode="after")
    def error_type_only_on_incorrect_trials(self) -> "TrialCreate":
        # Mirror the DB check constraint at the API boundary so invalid payloads
        # fail with a clear 422 rather than a cryptic DB constraint violation.
        if self.error_type is not None and self.accuracy:
            raise ValueError("error_type may only be set when accuracy is False")
        return self


class SessionCreate(BaseModel):
    user_id: str
    context_tag: ContextTag
    kss_pre: Optional[int] = Field(None, ge=1, le=9)
    kss_post: Optional[int] = Field(None, ge=1, le=9)
    sleep_hours: float = Field(ge=0)
    hours_since_waking: float = Field(ge=0)
    timezone: TimeZone
    trials: list[TrialCreate] = Field(min_length=1)


class TrialResponse(BaseModel):
    trial_id: uuid.UUID
    task_type: TaskType
    trial_number: int
    reaction_time_ms: Optional[float]
    accuracy: bool
    error_type: Optional[ErrorType]

    model_config = {"from_attributes": True}


class SessionResponse(BaseModel):
    session_id: uuid.UUID
    user_id: str
    timestamp: datetime
    context_tag: ContextTag
    kss_pre: Optional[int]
    kss_post: Optional[int]
    sleep_hours: float
    hours_since_waking: float
    timezone: TimeZone
    trials: list[TrialResponse]

    model_config = {"from_attributes": True}
