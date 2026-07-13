// Mirrors backend/app/models.py enums and backend/app/schemas.py request shapes.
// Kept in lockstep by hand (no shared codegen yet) — if the backend schema changes,
// update here too.

export type ContextTag = "morning" | "pre_work" | "post_work" | "pre_sleep" | "other";

export type TaskType = "pvt" | "nback" | "stroop";

// "none" = incorrect trial with no further error classification (e.g. a PVT
// non-response). Distinct from omitting error_type entirely, which means the
// trial was correct and the field doesn't apply.
export type ErrorType = "interference" | "random" | "none";

export interface TrialCreate {
  task_type: TaskType;
  trial_number: number;
  reaction_time_ms: number | null;
  accuracy: boolean;
  error_type: ErrorType | null;
  raw_response?: Record<string, unknown> | null;
}

export interface SessionCreate {
  user_id: string;
  context_tag: ContextTag;
  kss_pre: number | null;
  kss_post: number | null;
  sleep_hours: number | null;
  hours_since_waking: number | null;
  trials: TrialCreate[];
}

export interface TrialResponse {
  trial_id: string;
  task_type: TaskType;
  trial_number: number;
  reaction_time_ms: number | null;
  accuracy: boolean;
  error_type: ErrorType | null;
}

export interface SessionResponse {
  session_id: string;
  user_id: string;
  timestamp: string;
  context_tag: ContextTag;
  kss_pre: number | null;
  kss_post: number | null;
  sleep_hours: number | null;
  hours_since_waking: number | null;
  trials: TrialResponse[];
}
