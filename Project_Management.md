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
- **Session frequency:** 2-3x/day - morning, pre-work, post-work, pre-sleep (self-tagged by context, not fixed clock time, to separate causal fatigue sources: circadian vs. cognitive-exertion fatigue)
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
 
### Baseline
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
- [x] Prod DB migrated: `alembic upgrade head` run against the prod Supabase project (was previously unmigrated — confirmed via `alembic current` showing no revision beforehand). Verified after migrating: `sessions`/`trials` tables, the `contexttag`/`tasktype`/`errortype` enums, all three check constraints, and the `pgvector` extension all present, matching dev exactly. No write+delete round-trip test was run against prod itself (unlike every dev verification in this log) — prod is meant to hold only real data from the start, so this was a schema-only check. `backend/.env`'s active `DATABASE_URL` now points at prod.
- [x] Begin real 2-3x/day self-testing data collection against the **prod** DB — underway; README updated to reflect actual cadence (originally targeted 3-4x/day, revised down after starting real usage).

### Phase 2 (started early) — N-back frontend, ahead of real data collection
Decided to build the N-back and Stroop tasks *before* starting real 2-3x/day collection, reversing the original phase order. Reason: baseline calibration uses each user's first 5 sessions, and the eventual model treats a session as trials across all three tasks together — starting real collection with PVT-only would make the earliest (and calibration-critical) sessions a different shape than everything collected afterward, with no way to backfill. A few days of frontend work up front is cheaper than weeks of inconsistent baseline data later.

- [x] N-back frontend implemented (`frontend/src/tasks/nback/`): `nbackConfig.ts` (protocol constants + sequence generator), `useNbackTask.ts` (idle → stimulus → blank → finished reducer), `NbackTask.tsx`. Wired into `App.tsx` between PVT and the post-KSS/submit stage.
- [x] N-back protocol parameters decided — not specified in this document's original draft, so recorded here for the record (full rationale as code comments in `frontend/src/tasks/nback/nbackConfig.ts`):
  - Fixed 2-back, not adaptive — difficulty must stay constant across sessions/days so a performance change reflects fatigue, not a difficulty change.
  - Fixed SOA (2.5s: 500ms letter + up to 2s more to respond) rather than PVT's randomized ISI — n-back is a memory-matching judgment, not a speeded-detection race, so there's no anticipation effect to guard against.
  - Two forced-choice keys (F = match, J = no match) on every trial, rather than a single respond-on-match-only key — avoids the ambiguity of a withheld response (correctly-no-match vs. missed).
  - The first 2 trials of each session can't be targets (nothing 2-back yet) and are recorded as ordinary trials with ground truth "no match", not dropped.
  - `error_type`: wrong button → `"random"` (general error; `"interference"` stays Stroop-only), timeout with no response → `"none"` — same convention as PVT.
  - 36 trials/session, ~30% target rate, 8-consonant letter pool (excludes vowels and visually/phonetically similar letters) — standard n-back protocol choices to prevent guessing and chunking strategies.
- [x] End-to-end flow re-verified with a scripted Playwright run (PVT → N-back → submit) against an isolated backend/frontend instance pointed at the dev DB (kept separate from the locally running dev servers to avoid interfering with them): 20 PVT trials + 36 N-back trials recorded with correct `trial_number` sequencing, `accuracy`/`error_type` consistent with the DB check constraint, and correct `reaction_time_ms` semantics (including the first N-back trial being correctly scored as an error, since a lead-in trial can't be a genuine match). Test session and its 56 trials cascade-deleted from the dev DB afterward.
- [x] Stroop frontend implemented (`frontend/src/tasks/stroop/`): `stroopConfig.ts` (color/word/key mapping, congruent/incongruent sequence generator), `useStroopTask.ts` (idle → isi → stimulus → finished reducer), `StroopTask.tsx` (always-visible key-color legend). Wired into `App.tsx` as the third task stage, between N-back and the post-KSS/submit stage — this completes the three-task protocol from the Cognitive Tasks table above.
- [x] Stroop protocol parameters decided — not specified in this document's original draft, so recorded here for the record (full rationale as code comments in `frontend/src/tasks/stroop/stroopConfig.ts`):
  - 4-color palette (red/green/blue/yellow), 50/50 congruent/incongruent trials randomly interleaved (not blocked), no neutral condition.
  - Response keys (D/F/J/K) are arbitrary, not first-letter mnemonics, and shown as an always-visible legend rather than memorized — first-letter keys would let word-reading leak directly into the response, undermining the interference measure itself; an always-visible legend also keeps "forgot the mapping" errors (a memory failure) out of the interference/random error signal.
  - Fixed (not randomized) 500ms ISI between trials — unlike PVT, Stroop's signal of interest (interference cost = incongruent RT − congruent RT) isn't confounded by a predictable rhythm, and a fixed short ISI is standard in computerized Stroop batteries.
  - `error_type`: wrong color on an incongruent trial → `"interference"` (the schema's one use of this value), wrong color on a congruent trial → `"random"`, no response before the 2.5s timeout → `"none"`.
  - A keypress during the ISI/fixation is ignored rather than scored — Stroop has no PVT-style "false start" failure mode.
  - 40 trials/session (20 congruent, 20 incongruent).
- [x] End-to-end flow re-verified with two scripted Playwright runs (PVT → N-back → Stroop → submit) against the same isolated dev-DB backend/frontend pair used for the N-back verification: one run answered every Stroop trial by reading the actual rendered ink color (confirmed 100% accuracy, correct `trial_number` sequencing 1-40, and `reaction_time_ms`/`error_type` consistency with the DB check constraint); a second run deliberately answered every trial with the same key regardless of ink color, producing both `"interference"` (16) and `"random"` (15) errors that summed correctly with the correct-response count — confirming the interference-vs-random classification branch actually works, not just the happy path. Both test sessions (96 trials each) cascade-deleted from the dev DB afterward.

### N-back UX revision (before real data collection started)
Self-testing with the first N-back version surfaced a real usability problem: each letter was only visible for 500ms and then blanked while the 2.5s response window kept running silently, so there was no way to tell how much time was left to answer. Revised before any real data was collected, based on a reference the user pointed to (a word-list working-memory task with a visible per-item countdown) — full rationale as code comments in `frontend/src/tasks/nback/nbackConfig.ts`:
- Switched from single letters to short, unrelated concrete-noun words (`WORD_POOL`) — avoids any word that's also a color name (N-back and Stroop can appear in the same session), avoids shared stems/rhymes/category overlap between pool members.
- Collapsed the old flash-then-blank (`STIMULUS_DISPLAY_MS` + separate response window) into one continuous `TRIAL_DURATION_MS` (3000ms) — the word now stays visible and answerable for the whole trial, no separate "did I miss it" phase.
- Added a visual countdown bar (`NbackTask.tsx`) that ticks down over `TRIAL_DURATION_MS`, driven by its own `requestAnimationFrame` loop — purely cosmetic, same as PVT's live ms counter; the actual trial timeout is still scored off `performance.now()` deltas inside `useNbackTask.ts`, unaffected by the display.
- Added an always-visible F/J key legend (idle screen and during trials), since the key mapping is arbitrary and there's no reason to make the participant memorize it under time pressure.
- Trial count reduced from 36 to 30 to keep the worst-case session length (all trials timing out) close to the original ~90s target now that each trial's window is longer (3s vs. the old 2.5s).
- Re-verified end-to-end (including a deliberately forced timeout on one trial mid-session, to confirm the "none"/no-response path still scores correctly under the new single-phase design) against the isolated dev-DB pair; test session cascade-deleted afterward.

**Follow-up tweaks after further self-testing:**
- N-back `TRIAL_DURATION_MS` bumped 3000 → 4000ms — 3s still felt tight for reading a word and comparing it against memory. Worst-case session length grows to 120s (30 trials × 4s) accordingly, still within the 5-minute full-session budget.
- `SessionSetupForm.tsx`'s sleep-hours and hours-since-waking inputs got `max="24"` — relies on native HTML5 constraint validation (the form's `Continue to task` button won't submit past an out-of-range value); no backend/schema change made, since neither field has an upper bound enforced server-side today — worth a follow-up if bad values ever need blocking closer to the DB, not just at this one form.

**Follow-up fix — countdown bar rendering.** After this revision shipped, real usage surfaced that the countdown bar itself didn't look right in the browser. Root cause: `index.css`'s `.nback-timer-fill` had `transition: width 80ms linear` on it, fighting the ~60fps JS updates from `useCountdownFraction` — each new width retriggered a fresh 80ms transition before the last one finished, so the rendered bar perpetually lagged behind real elapsed time instead of tracking it. The first verification pass missed this because it read the element's `style.width` attribute (the JS target value) rather than its actual rendered pixel width, so the lag was invisible to that check. Fixed by removing the CSS transition entirely — the per-frame JS updates are smooth enough on their own. Re-verified this time by sampling the element's real `boundingBox()` width every 250ms across a full trial: the rendered fill tracked the expected linear decay from 100%→0% over the 3000ms window to within a fraction of a percentage point at every sample, and reset promptly (no gradual climb) at the next trial boundary.