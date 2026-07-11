# Project Context for Claude Code

This file is context for AI-assisted coding sessions on this project. Read this before making changes. It reflects real decisions already made — don't relitigate them without asking; flag if something here seems wrong rather than silently deviating.

## What this project is

A cognitive fatigue assessment platform. Users take short, validated cognitive tasks (PVT, N-back, Stroop) multiple times a day. Trial-level behavioral data (reaction time, accuracy, error type, variability) plus self-reported sleepiness (KSS) feeds a PyTorch model that predicts a personalized fatigue score, which an LLM turns into a plain-language, research-grounded readout (via RAG over a small neuroscience abstract corpus).

Full design rationale lives in `Project_Management.md` in this repo — read it for the "why," this file is the "how to work on it."

This is a portfolio project. Code quality, clear commit history, and defensible design decisions matter more than speed. I need to be able to explain every design choice in an interview, so prefer explicit, readable code over clever shortcuts, and leave comments explaining *why* on any non-obvious decision (e.g., why a feature is computed a certain way, why a constraint exists).

## Current phase

**Phase 1: Database + minimal ingestion.** Goal: real schema, real data flowing, as early as possible — not a placeholder format we'll migrate away from later. See `Project_Management.md` roadmap for the full phase sequence; we are intentionally moving DB setup and minimal logger in parallel, not building the full backend before collecting anything.

## Tech stack (decided, don't change without discussion)

- **Frontend:** React, minimal/clean UI, client-side timing via `performance.now()` (not server round-trip — network jitter would contaminate reaction-time data)
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

Set up the database layer:
1. SQLAlchemy models matching the schema above (`sessions`, `trials`), with proper enum/constraint definitions.
2. Initialize Alembic, generate the first migration from these models.
3. Enable the `pgvector` extension in the migration (unused for now, reserved for the RAG phase).
4. A minimal FastAPI POST endpoint to insert a session + its trials, sufficient to support a bare-bones PVT-only logging page (no auth yet — single-user, self-testing phase).

Do not build out the full task battery (N-back, Stroop), frontend polish, auth, modeling, or LLM/RAG code yet — those are later phases per `Project_Management.md`. Keep this session scoped to DB + minimal ingestion.

## Conventions

- Python: type hints throughout, `black` formatting.
- Commit granularity: small, logical commits with clear messages — commit history is part of the portfolio narrative, not just a build log.
- No secrets, API keys, or credentials committed, ever — use `.env` + `.gitignore`.
- Prefer explicit over implicit (e.g., explicit enum classes over magic strings) since this codebase needs to be legible to an interviewer skimming it, not just functional.