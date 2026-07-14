// Project_Management.md specifies "~90 sec" for the N-back but doesn't pin
// down exact parameters. Decisions made here (flagged per CLAUDE.md — review
// before trusting the collected data):
//
// - N = 2 (2-back), fixed rather than adaptive. Adaptive n-back (raising n
//   when the user does well) is the common design in working-memory
//   *training* studies, but this is a fatigue *measurement* tool — task
//   difficulty needs to stay constant across sessions and across days so a
//   change in performance can be attributed to fatigue rather than a change
//   in difficulty. 2-back is the standard fixed level used in fatigue/sleep-
//   deprivation n-back studies (loads working memory without putting a
//   well-rested baseline at floor or ceiling).
//
// - Fixed SOA (stimulus-onset-asynchrony) per trial, unlike PVT's randomized
//   ISI. PVT randomizes ISI specifically so the participant can't anticipate
//   stimulus timing (anticipation would contaminate the reaction-time
//   measure). N-back has no equivalent failure mode — it's a memory-matching
//   judgment, not a speeded-detection race — so a fixed, predictable rhythm
//   is standard practice and keeps the "n positions back" structure legible.
//
// - Two forced-choice response keys (F = match, J = no match) rather than a
//   single respond-only-on-match key. A single-key design makes a
//   non-response ambiguous (correctly withheld vs. missed); forcing an
//   explicit response every trial keeps accuracy/error_type well-defined for
//   every trial, same as PVT and (later) Stroop.
//
// - The first N trials of the sequence can't be targets (there's nothing N
//   back yet to compare against) and are still recorded as ordinary trials
//   with ground truth "no match", not dropped or specially flagged. This
//   matches standard n-back scoring practice and keeps trial_number
//   contiguous for every session.
//
// - error_type mirrors PVT's non-Stroop convention: a wrong button press is
//   "random" (a general error, not an interference error — that concept is
//   Stroop-specific), a timeout with no response at all is "none".
//
// - Letter pool excludes vowels and visually/phonetically similar
//   consonants, standard practice to stop participants from encoding runs of
//   letters as pronounceable chunks instead of tracking individual items.
//
// - Target rate ~30% of scorable trials, not 50/50 — a 50/50 split makes
//   pure guessing nearly as good as actually tracking the sequence; ~30% is
//   the conventional rate in the n-back literature.

export const N_BACK_N = 2;
export const TRIAL_COUNT = 36;

export const STIMULUS_DISPLAY_MS = 500;
// Total time from stimulus onset until the trial is scored as a non-response
// if no key has been pressed yet — covers both the visible and blank
// portions of the trial (the response window doesn't end when the letter
// disappears, only when the next trial's stimulus appears).
export const RESPONSE_WINDOW_MS = 2500;

export const TARGET_PROBABILITY = 0.3;

export const LETTER_POOL = ["C", "F", "H", "K", "L", "Q", "R", "T"] as const;
export type NbackLetter = (typeof LETTER_POOL)[number];

export const MATCH_KEY = "KeyF";
export const NO_MATCH_KEY = "KeyJ";

function randomLetter(): NbackLetter {
  return LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)];
}

// Builds the full trial sequence up front rather than trial-by-trial, so the
// target rate is controlled deterministically instead of relying on
// independent per-trial coin flips (which could, by chance, produce far more
// or fewer targets than intended over a single session).
export function generateSequence(trialCount: number = TRIAL_COUNT, n: number = N_BACK_N): NbackLetter[] {
  const sequence: NbackLetter[] = [];
  for (let i = 0; i < trialCount; i++) {
    if (i < n) {
      sequence.push(randomLetter());
      continue;
    }
    const isTarget = Math.random() < TARGET_PROBABILITY;
    if (isTarget) {
      sequence.push(sequence[i - n]);
    } else {
      let letter: NbackLetter;
      do {
        letter = randomLetter();
      } while (letter === sequence[i - n]);
      sequence.push(letter);
    }
  }
  return sequence;
}

export function isTargetTrial(sequence: NbackLetter[], index: number, n: number = N_BACK_N): boolean {
  return index >= n && sequence[index] === sequence[index - n];
}
