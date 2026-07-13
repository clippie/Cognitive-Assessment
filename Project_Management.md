# Cognitive Assessment Platform
 
## Abstract
A self-contained web platform that measures cognitive fatigue through short, validated behavioral tasks rather than self-report alone. Users complete brief cognitive assessments multiple times per day (morning / post-work / pre-sleep), generating a longitudinal dataset of reaction-time, accuracy, and response-dynamics features. A PyTorch model trained on this data and combined with self-reported sleepiness scores as a weak label, predicts a personalized fatigue/attention score. An LLM layer converts model output and historical trend into a plain-language, structured readout tailored to the individual user.
 
**This is a portfolio research project, not a clinical or diagnostic tool.*
 
## Goals
- Demonstrate end-to-end ML engineering: data collection design, feature engineering, model training (including self-supervised pretraining), and production deployment
- Demonstrate modern deep learning fluency: transformer architecture applied to sequential behavioral data
- Demonstrate LLM tooling: structured/function-calling output generation, not just prompt-and-summarize
- Produce a usable tool with real users and real data
## Cognitive Tasks
| Task | Measures | Duration |
|---|---|---|
| Psychomotor Vigilance Task (PVT) | Sustained attention, raw reaction time; gold standard in sleep/fatigue research | ~90 sec |
| N-back (working memory) | Working memory load, degrades under fatigue/cognitive load | ~90 sec |
| Stroop task | Attentional control; interference errors vs. random errors | ~90 sec |
 
Full session target: under 5 minutes, to keep friction low enough for repeated real-world use (3x/day).
 
## Data
 
### Collection design
- **Session frequency:** 4x/day - morning, pre-work, post-work, pre-sleep (self-tagged by context, not fixed clock time, to separate causal fatigue sources: circadian vs. cognitive-exertion fatigue)
- **Baseline calibration:** first 5 sessions per user establish an individual baseline; subsequent scoring measures deviation from that baseline rather than an absolute population score
- **Weak label:** Karolinska Sleepiness Scale (KSS, 1–9) collected pre and post-session — a validated instrument, used as a noisy label rather than ground truth
- **Additional self-report:** hours of sleep
### Features captured per trial
- Reaction time (client-side `performance.now()` timing — not server round-trip, to avoid network jitter contaminating signal)
- Accuracy and error type (e.g., Stroop interference error vs. random error)
- Within-block reaction time variability (fatigue tends to show up as increased variance, not just slower mean reaction time)
- Response dynamics (stretch goal): mouse trajectory curvature, keypress dwell time
### Working hypothesis (to be tested, not assumed)
Cognitive task performance (RT, variability, error patterns) carries more fatigue signal than self-report alone, and the two diverge in informative ways (e.g., a user may self-report as alert while task performance shows attentional lapses).
 
### Draft schema
```
sessions
- session_id (PK)
- user_id
- timestamp
- context_tag (morning | pre_work | post_work | pre_sleep | other)
- kss_pre, kss_post
- sleep_hours, hours_since_waking
 
trials
- trial_id (PK)
- session_id (FK)
- task_type (pvt | nback | stroop)
- trial_number
- reaction_time_ms
- accuracy (bool)
- error_type (nullable: interference | random | none)
- raw_response (json — for mouse/keypress dynamics later)
```
 
## Modeling
 
### Baseline (build first)
Simple regression / gradient boosting (XGBoost) predicting KSS score or context_tag from aggregated trial features. Establishes that signal exists in the data before reaching for a more complex architecture, and gives a benchmark the transformer needs to beat.
 
### Primary model
- Represent each session as a sequence of trial-level feature vectors → transformer encoder (sequence-of-trials is a natural fit for attention over time)
- **Self-supervised pretraining:** predict trial number / time-elapsed-in-session from behavioral features alone, across all users — a proxy for within-session fatigue drift that doesn't require any label
- **Fine-tuning:** per-user, using KSS self-report as weak supervision, on top of the pretrained encoder
- **Personalization:** score expressed as deviation from each user's own calibration baseline, not an absolute population score
### Evaluation plan
- Baseline model performance (regression/GBM) as the floor
- Transformer performance vs. baseline on held-out sessions
- Qualitative check: does the model's attention over trials align with intuitive fatigue moments (e.g., late-session degradation)?
- Interpretability output: visualize attention weights per trial as part of the dashboard
## LLM Layer
- Input: model's fatigue score, historical trend, which specific task/metric drove the score (e.g., Stroop interference errors vs. general RT slowing)
- Approach: structured/function-calling rather than a single free-text prompt — LLM selects which stat/chart is most anomalous and generates a personalized, specific readout (e.g., distinguishing "attentional lapse" pattern from "general slowing" pattern)
- Output surfaces in the user dashboard alongside the raw visualization, not as a replacement for it
### RAG (literature grounding)
- **Purpose:** ground LLM claims in published research rather than the user's data alone — e.g., "this pattern matches published findings on attentional lapses under sleep deprivation" instead of just a raw score
- **Corpus:** curated, not exhaustive — ~30-50 abstracts pulled via PubMed API, scoped tightly to: PVT/sleep deprivation (e.g., Dinges & Powell foundational work), Stroop interference under fatigue, N-back/working memory under sleep loss, KSS validation studies
- **Storage:** pgvector (extends existing Postgres instance rather than adding a separate vector DB — deliberate infra simplicity)
- **Retrieval trigger:** only fires when the LLM is about to make a claim referencing general research, not on every readout — keeps cost/latency down and keeps usage purposeful rather than bolted on
- **Grounding/citation:** structured output includes a `source` field tying a specific claim to a specific abstract; surfaced in UI as a small "based on: [study]" footnote

## Tech Stack
- **Frontend:** React + TypeScript, precise client-side timing, minimal/clean UI
- **Backend:** FastAPI
- **Database:** PostgreSQL
- **Modeling:** PyTorch (training), ONNX export for lightweight inference serving (stretch goal)
- **Deployment:** Fly.io or Render, real domain + HTTPS
- **AI-assisted tooling:** used for scaffolding/boilerplate (CRUD endpoints, auth, deployment config); task design, feature engineering, model architecture, and calibration approach are hand-designed — noted transparently in README
## Ethics & Privacy
- Informed consent screen before first session (what's collected, how it's used)
- Explicit disclaimer: portfolio research project, not a medical or diagnostic tool
- Data-use disclosure for any user beyond the author
 
## Status / Decision Log

### Phase 1 — database + minimal ingestion
- [x] Database schema designed and migrated to dev Supabase: SQLAlchemy models + Alembic migration (`backend/alembic/versions/0001_initial_schema.py`). Verified live against Supabase: both tables, DB-level enums, check constraints (`kss_pre`/`kss_post` range, `error_type` tied to `accuracy = false`), FK cascade delete, and the `pgvector` extension are all present and working as designed.
- [x] FastAPI backend (`backend/app/main.py`): single `POST /sessions` endpoint inserting a session and all its trials atomically. Pydantic schemas mirror the DB constraints so invalid payloads 422 before ever reaching the DB. CORS added (`CORS_ALLOWED_ORIGINS` env var) once the frontend needed to call it cross-origin from the Vite dev server.
- [x] React + TypeScript frontend (`frontend/`, Vite) implementing the full PVT session flow: setup form (user id, context tag, sleep hours, hours since waking, pre-KSS) → PVT task → post-KSS → submit to `POST /sessions`. TypeScript was chosen over plain JS specifically to mirror the backend's "type hints throughout" convention — request/response types in `frontend/src/types/session.ts` are hand-mirrored from `backend/app/schemas.py` (no shared codegen yet, so these need to be kept in sync manually when the backend schema changes).
- [x] PVT protocol parameters decided — not fully specified in this document's original draft, so recorded here for the record (full rationale as code comments in `frontend/src/tasks/pvt/pvtConfig.ts`):
  - Fixed 20-trial session rather than a fixed wall-clock duration, so every session produces a same-length trial sequence; ISI (randomized 2-5s per trial) is the controlled variable, not total duration.
  - 2s response timeout after stimulus onset before a trial counts as a non-response.
  - PVT is modeled as a *speed* task, not a correct/incorrect task: any on-time response is `accuracy: true` no matter how slow — a "lapse" in PVT terms is read off `reaction_time_ms` downstream, not encoded as an error. Only two things count as an actual error: a false start (response before the stimulus appears, `error_type: "random"`) and a true non-response (`error_type: "none"`, mirroring the DB model's "incorrect trial, no further classification" semantics — PVT has no interference-error concept, that's Stroop-specific).
- [x] End-to-end flow verified with a scripted headless-browser (Playwright) run against the local dev servers: deliberate false start, deliberate non-response timeout, and 18 timed responses all recorded with correct `accuracy`/`error_type`/`reaction_time_ms`; the resulting session round-tripped through the dev DB with correct values end to end; cascade delete re-confirmed by cleaning up the test session afterward (0 orphaned trials).
- [ ] Begin real 3-4x/day self-testing data collection against the **prod** DB (all testing so far has used the dev DB — swap `DATABASE_URL` before starting real collection).