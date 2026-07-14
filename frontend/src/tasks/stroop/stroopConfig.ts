// Project_Management.md specifies "~90 sec" for the Stroop task but doesn't
// pin down exact parameters. Decisions made here (flagged per CLAUDE.md —
// review before trusting the collected data):
//
// - Four colors (red/green/blue/yellow), the standard Stroop palette —
//   enough to make word-reading a real competing response, not so many that
//   the four-way choice itself becomes the bottleneck instead of the
//   word/ink conflict.
//
// - Response keys (D/F/J/K) are arbitrary, not first-letter mnemonics
//   ("R" for red, etc.), and their color mapping is shown as an always-
//   visible on-screen legend throughout the task rather than memorized
//   beforehand. Two reasons: first-letter keys would let the word itself
//   leak into the response mapping (reading "RED" and hitting "R" doesn't
//   require resolving the ink color at all, which would water down the
//   exact interference effect this task exists to measure); and forgetting
//   an arbitrary mapping mid-task would produce wrong-key errors that are
//   really a memory failure, not a Stroop interference or attention error —
//   contaminating error_type with a category the schema has no room for.
//
// - Congruent/incongruent trials are 50/50 and randomly interleaved (not
//   blocked), so an interference cost can be computed as incongruent RT
//   minus congruent RT within the same session, and so the participant
//   can't adopt a block-level strategy (e.g. "ignore the word" only when a
//   run of incongruent trials becomes predictable).
//
// - No neutral (non-color-word) condition. A three-way congruent/
//   incongruent/neutral design is the fuller classic Stroop paradigm, but
//   the two-way congruent/incongruent version is standard in briefer
//   fatigue-monitoring batteries and is enough to compute an interference
//   cost — adding neutral trials would extend the session without changing
//   what this task is measuring here.
//
// - Fixed (not randomized) ISI between trials. PVT randomizes ISI
//   specifically to prevent anticipating stimulus *onset*, because PVT is a
//   sustained-attention/vigilance measure where anticipation itself would
//   contaminate the reaction-time signal. Stroop's signal of interest is
//   the RT difference between congruent and incongruent trials, which a
//   fixed rhythm doesn't confound — and a fixed short ISI (with a fixation
//   cross) is what standard computerized Stroop batteries use.
//
// - error_type mapping is the one place Stroop actually uses
//   "interference" (the other tasks don't — see pvtConfig.ts / nbackConfig.ts):
//     - wrong color on an incongruent trial -> "interference" (the word and
//       ink disagreed, and the response followed the word)
//     - wrong color on a congruent trial -> "random" (word and ink agreed,
//       so a wrong answer isn't attributable to word/ink conflict)
//     - no response before the timeout -> "none"
//
// - A keypress during the ISI/fixation phase is simply ignored rather than
//   scored as a "false start" the way PVT does. PVT's false-start concept
//   exists because PVT is specifically a race against an anticipated
//   stimulus; Stroop has no equivalent failure mode, and none of
//   interference/random/none cleanly describes "responded before there was
//   anything to respond to."

export const COLORS = ["red", "green", "blue", "yellow"] as const;
export type StroopColor = (typeof COLORS)[number];

export const COLOR_WORDS: Record<StroopColor, string> = {
  red: "RED",
  green: "GREEN",
  blue: "BLUE",
  yellow: "YELLOW",
};

// Ink colors used for rendering — chosen for clear mutual distinguishability
// on both light and dark backgrounds, not just "true" red/green/blue/yellow.
export const COLOR_HEX: Record<StroopColor, string> = {
  red: "#e74c3c",
  green: "#2ecc71",
  blue: "#3498db",
  yellow: "#f1c40f",
};

// Arbitrary, not first-letter mnemonics — see rationale above.
export const RESPONSE_KEYS: Record<StroopColor, string> = {
  red: "KeyD",
  green: "KeyF",
  blue: "KeyJ",
  yellow: "KeyK",
};

export const TRIAL_COUNT = 40;
export const ISI_MS = 500;
export const RESPONSE_TIMEOUT_MS = 2500;

export interface StroopTrialSpec {
  // The ink color the word is rendered in — this is the correct response.
  inkColor: StroopColor;
  // The color the word spells out. Equals inkColor on congruent trials.
  wordColor: StroopColor;
  congruent: boolean;
}

function randomColor(): StroopColor {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Builds an exactly-balanced 50/50 congruent/incongruent set, then shuffles
// trial order — deterministic balance rather than a per-trial coin flip, for
// the same reason nbackConfig.ts controls its target rate deterministically:
// independent per-trial randomness could by chance skew the congruent/
// incongruent split over a single session.
export function generateSequence(trialCount: number = TRIAL_COUNT): StroopTrialSpec[] {
  const specs: StroopTrialSpec[] = [];
  for (let i = 0; i < trialCount; i++) {
    const congruent = i < trialCount / 2;
    const inkColor = randomColor();
    let wordColor: StroopColor;
    if (congruent) {
      wordColor = inkColor;
    } else {
      do {
        wordColor = randomColor();
      } while (wordColor === inkColor);
    }
    specs.push({ inkColor, wordColor, congruent });
  }
  return shuffle(specs);
}
