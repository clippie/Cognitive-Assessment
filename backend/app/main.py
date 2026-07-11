from fastapi import Depends, FastAPI
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models import Session as SessionModel, Trial as TrialModel
from app.schemas import SessionCreate, SessionResponse

app = FastAPI(title="Cognitive Assessment API")


@app.post("/sessions", response_model=SessionResponse, status_code=201)
def create_session(payload: SessionCreate, db: DBSession = Depends(get_db)) -> SessionResponse:
    """
    Insert a completed session and all its trials atomically.
    The session timestamp is assigned server-side; the client provides everything else.
    """
    session = SessionModel(
        user_id=payload.user_id,
        context_tag=payload.context_tag,
        kss_pre=payload.kss_pre,
        kss_post=payload.kss_post,
        sleep_hours=payload.sleep_hours,
        hours_since_waking=payload.hours_since_waking,
    )
    db.add(session)
    # Flush to generate session_id (via DB default) before attaching trials.
    db.flush()

    for t in payload.trials:
        trial = TrialModel(
            session_id=session.session_id,
            task_type=t.task_type,
            trial_number=t.trial_number,
            reaction_time_ms=t.reaction_time_ms,
            accuracy=t.accuracy,
            error_type=t.error_type,
            raw_response=t.raw_response,
        )
        db.add(trial)

    db.commit()
    db.refresh(session)
    return session
