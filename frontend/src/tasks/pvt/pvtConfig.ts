// Project_Management.md specifies "~90 sec" for the PVT but doesn't pin down
// exact timing. Decisions made here (flagged per CLAUDE.md — review before
// trusting the collected data):
//
// - Fixed TRIAL_COUNT rather than a fixed wall-clock duration, so every
//   session produces a same-length trial sequence. ISI is randomized per
//   trial (the real independent variable in PVT protocol); session duration
//   is just whatever falls out of that, not a controlled parameter itself.
// - accuracy/error_type mapping (see usePvtTask.ts) treats PVT as a *speed*
//   task, not a correct/incorrect task: any response after stimulus onset
//   and before the timeout is "accurate" — a slow response (a "lapse" in PVT
//   literature) is still accurate, just slow, and that signal lives entirely
//   in reaction_time_ms. Only two things count as an actual error:
//     - a false start (keydown during the ISI, before the stimulus appears)
//       -> accuracy: false, error_type: "random"
//     - a timeout (no response at all before RESPONSE_TIMEOUT_MS elapses)
//       -> accuracy: false, error_type: "none" (mirrors models.py: an
//          incorrect trial with no further error classification)
//   PVT has no interference-error concept — that's Stroop-specific.

export const TRIAL_COUNT = 20;

export const ISI_MIN_MS = 2000;
export const ISI_MAX_MS = 5000;

// Max time to wait for a response after the stimulus appears before counting
// the trial as a non-response (a classic PVT "lapse" is >500ms; this timeout
// is much longer than that on purpose — it only catches true non-responses,
// the lapse itself is read off reaction_time_ms downstream).
export const RESPONSE_TIMEOUT_MS = 2000;

export function randomIsiMs(): number {
  return ISI_MIN_MS + Math.random() * (ISI_MAX_MS - ISI_MIN_MS);
}
