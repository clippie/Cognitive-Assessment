# Project Context for Claude Code

This file is context for AI-assisted coding sessions on this project. Read this before making changes. It reflects real decisions already made — don't relitigate them without asking; flag if something here seems wrong rather than silently deviating.

## What this project is

A cognitive fatigue assessment platform. Users take short, validated cognitive tasks (PVT, N-back, Stroop) multiple times a day. Trial-level behavioral data (reaction time, accuracy, error type, variability) plus self-reported sleepiness (KSS) feeds a PyTorch model that predicts a personalized fatigue score, which an LLM turns into a plain-language, research-grounded readout (via RAG over a small neuroscience abstract corpus).

Full design rationale lives in `Project_Management.md` in this repo — read it for the "why," this file is the "how to work on it."

This is a portfolio project. Code quality, clear commit history, and defensible design decisions matter more than speed. I need to be able to explain every design choice in an interview, so prefer explicit, readable code over clever shortcuts, and leave comments explaining *why* on any non-obvious decision (e.g., why a feature is computed a certain way, why a constraint exists).

## Current phase

**Phase 1: Database + minimal ingestion** — in progress.

### Completed
- SQLAlchemy models (`backend/app/models.py`) — `Session` and `Trial` with DB-level enum types, check constraints, and cascade delete.
- Alembic initialized with first migration (`backend/alembic/versions/0001_initial_schema.py`) — creates both tables and enables the `pgvector` extension.
- Pydantic schemas (`backend/app/schemas.py`) — request validation mirrors DB constraints so invalid payloads fail fast with a 422 before hitting the DB.
- FastAPI app (`backend/app/main.py`) — single `POST /sessions` endpoint that inserts a session and all its trials atomically. CORS enabled via `CORS_ALLOWED_ORIGINS` env var so the Vite dev server (and later the deployed frontend) can call it.
- React + TypeScript frontend (`frontend/`, Vite) — session setup form (user id, context tag, sleep hours, hours since waking, pre-KSS) → PVT task → post-KSS → submits the completed session to `POST /sessions`. Structure:
  - `src/types/session.ts` — TS types mirroring `backend/app/schemas.py` exactly (kept in sync by hand, no shared codegen yet).
  - `src/api/` — `client.ts` (fetch wrapper, `VITE_API_URL`-based) and `sessions.ts` (`submitSession`).
  - `src/tasks/pvt/` — `pvtConfig.ts` (trial count / ISI / timeout constants, with the accuracy/error_type mapping rationale documented inline), `usePvtTask.ts` (state machine as a reducer: idle → isi → stimulus → finished), `PvtTask.tsx` (render + live ms counter).
  - `src/components/` — `SessionSetupForm.tsx`, `KssRating.tsx` (reusable 1-9 scale), `SessionSubmit.tsx`.
- End-to-end flow verified with a scripted Playwright run against the local dev servers: false start, non-response timeout, and 18 timed responses all recorded with correct `accuracy`/`error_type`/`reaction_time_ms`; session landed correctly in the dev DB; cascade delete re-verified by cleaning up the test session afterward.

### Next steps (Phase 1 remaining)
- [x] Connect to Supabase dev DB and run `alembic upgrade head` to apply the migration.
- [x] Verify schema in Supabase dashboard — confirm tables, enums, and constraints are present.
- [x] Build minimal React PVT task page (client-side `performance.now()` timing) that POSTs to `/sessions`.
- [ ] Begin collecting real data (3-4x/day personal sessions).

### Phase 2 (not started)
- N-back and Stroop task implementations in the frontend.
- User auth (after initial self-testing data collection is underway).
- Feature engineering pipeline (aggregate trial-level features per session for model input).

See `Project_Management.md` for the full phase roadmap.

## Tech stack (decided, don't change without discussion)

- **Frontend:** React + TypeScript, minimal/clean UI, client-side timing via `performance.now()` (not server round-trip — network jitter would contaminate reaction-time data)
- **Backend:** FastAPI
- **Database:** PostgreSQL via Supabase (free tier), with `pgvector` extension enabled from the start (even though RAG comes later — keeps migration history coherent)
- **ORM / migrations:** SQLAlchemy models + Alembic migrations. No hand-run SQL against the live DB — every schema change is a versioned migration file.
- **Modeling:** PyTorch; XGBoost for the baseline model
- **Deployment:** Render (backend) + Vercel or Netlify (frontend), free tiers
- **LLM:** provider-agnostic wrapper (don't hardcode a single vendor SDK); cheapest/smallest model tier suitable for structured, short-form output
- **AI-assisted coding:** used for scaffolding/boilerplate; core design decisions (schema, feature engineering, model architecture, calibration logic) are mine and I need to understand and be able to explain all of them — flag anything you generate that embeds a non-obvious design decision so I can review it.

## Data model (source of truth — do not silently redesign)

```
sessions
- session_id (PK)
- user_id
- timestamp
- context_tag (enum: morning | pre_work | post_work | pre_sleep | other)
- kss_pre, kss_post (int, 1-9)
- sleep_hours, hours_since_waking

trials
- trial_id (PK)
- session_id (FK -> sessions.session_id, cascade delete)
- task_type (enum: pvt | nback | stroop)
- trial_number
- reaction_time_ms
- accuracy (bool)
- error_type (nullable enum: interference | random | none — only meaningful when accuracy = false; add a check constraint)
- raw_response (jsonb — reserved for future mouse/keypress dynamics, not used yet)
```

Design intent behind constraints (context for why, not just what):
- `context_tag` and `task_type` should be real DB-level enums or check constraints, not free-text columns trusted to the app layer.
- `error_type` should have a check constraint tying it to `accuracy = false`, to prevent inconsistent rows.
- Cascade delete on `trials` when a `session` is deleted (sessions own their trials).

## Environments

- Separate `dev` and `prod` databases from the start (two Supabase projects is fine). Do not mix schema experiments into the dataset intended for real longitudinal collection — the `prod` DB is where my own real 3-4x/day usage data lives starting immediately.
- `.env` for local config, never committed. Provide a `.env.example` with placeholder values.

## Immediate task for this session

React PVT page is built and verified end-to-end (see Completed, above). Remaining Phase 1 work is starting real 3-4x/day data collection: run the backend (`uvicorn app.main:app`) and frontend (`npm run dev` in `frontend/`) locally, or deploy, and start logging real sessions against the **prod** DB (swap `DATABASE_URL` — dev was used for all testing so far).

Non-obvious PVT protocol decisions made while building this (not fully specified in `Project_Management.md`, flagged per the policy above — review before trusting collected data, full rationale in `frontend/src/tasks/pvt/pvtConfig.ts`):
- Fixed 20-trial count per session rather than a fixed wall-clock duration.
- Random ISI 2-5s, 2s response timeout.
- PVT is treated as a speed task, not correct/incorrect: any on-time response is `accuracy: true` regardless of how slow (a "lapse" lives in `reaction_time_ms`, not as an error). Only false starts (`error_type: "random"`) and non-responses (`error_type: "none"`) count as errors.

## Conventions

- Python: type hints throughout, `black` formatting.
- Commit granularity: small, logical commits with clear messages — commit history is part of the portfolio narrative, not just a build log.
- No secrets, API keys, or credentials committed, ever — use `.env` + `.gitignore`.
- Prefer explicit over implicit (e.g., explicit enum classes over magic strings) since this codebase needs to be legible to an interviewer skimming it, not just functional.