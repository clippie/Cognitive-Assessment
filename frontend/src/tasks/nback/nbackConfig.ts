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
// - Word stimuli, not single letters (revised after self-testing — see
//   Project_Management.md's decision log). The original letter version
//   displayed each letter for only 500ms and then blanked it while the
//   response window kept running, which made it hard to tell how much time
//   was left to answer. Words: (a) stay on screen for the full trial
//   duration, so there's no separate "did I miss it" question, and (b) are
//   naturally slower to misread than a single flashed character, which
//   works in this task's favor now that the whole point is giving the
//   participant time to actually register and compare the item.
//
// - Fixed trial duration (word visible + answerable for the full window)
//   rather than PVT's randomized ISI. PVT randomizes ISI specifically so
//   the participant can't anticipate stimulus timing (anticipation would
//   contaminate the reaction-time measure). N-back has no equivalent
//   failure mode — it's a memory-matching judgment, not a speeded-detection
//   race — so a fixed, predictable rhythm is standard practice and keeps
//   the "n positions back" structure legible. A visible countdown bar
//   (rendered in NbackTask.tsx from this duration, not tracked here) makes
//   that fixed rhythm legible to the participant instead of just implicit.
//
// - Two forced-choice response keys (F = match, J = no match) rather than a
//   single respond-only-on-match key. A single-key design makes a
//   non-response ambiguous (correctly withheld vs. missed); forcing an
//   explicit response every trial keeps accuracy/error_type well-defined for
//   every trial, same as PVT and Stroop. The key legend is shown on screen
//   for the whole task (not just the instructions screen), since the
//   mapping is arbitrary and there's no reason to make the participant
//   memorize it under time pressure.
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
// - Word pool is deliberately unrelated, concrete nouns of no fixed length:
//   avoids rhymes, shared word stems, category overlap (no two animals,
//   etc.), or semantic association between pool members, so a match/
//   non-match judgment is about item identity, not meaning or sound.
//   Also avoids any color name, since a participant may do N-back and
//   Stroop in the same session.
//
// - Target rate ~30% of scorable trials, not 50/50 — a 50/50 split makes
//   pure guessing nearly as good as actually tracking the sequence; ~30% is
//   the conventional rate in the n-back literature.

export const N_BACK_N = 2;
export const TRIAL_COUNT = 30;

// Full time the word is visible and answerable, per trial. Unlike the
// original letter version, there's no separate flash-then-blank split — the
// word stays up and the countdown bar in NbackTask.tsx visibly ticks down
// this whole window, so "how much time do I have" is never ambiguous.
// Bumped from 3000 to 4000ms after self-testing found 3s still felt tight
// for reading a word and comparing it against memory. Worst-case session
// length (every trial timing out) grows to TRIAL_COUNT * 4s = 120s
// accordingly — still well inside the 5-minute full-session budget, and
// real usage is self-paced and much faster than the worst case anyway.
export const TRIAL_DURATION_MS = 4000;

export const TARGET_PROBABILITY = 0.3;

export const WORD_POOL = ["CHAIR", "RIVER", "PENCIL", "CLOUD", "GUITAR", "PILLOW", "ROCKET", "GARDEN"] as const;
export type NbackWord = (typeof WORD_POOL)[number];

export const MATCH_KEY = "KeyF";
export const NO_MATCH_KEY = "KeyJ";

function randomWord(): NbackWord {
  return WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)];
}

// Builds the full trial sequence up front rather than trial-by-trial, so the
// target rate is controlled deterministically instead of relying on
// independent per-trial coin flips (which could, by chance, produce far more
// or fewer targets than intended over a single session).
export function generateSequence(trialCount: number = TRIAL_COUNT, n: number = N_BACK_N): NbackWord[] {
  const sequence: NbackWord[] = [];
  for (let i = 0; i < trialCount; i++) {
    if (i < n) {
      sequence.push(randomWord());
      continue;
    }
    const isTarget = Math.random() < TARGET_PROBABILITY;
    if (isTarget) {
      sequence.push(sequence[i - n]);
    } else {
      let word: NbackWord;
      do {
        word = randomWord();
      } while (word === sequence[i - n]);
      sequence.push(word);
    }
  }
  return sequence;
}

export function isTargetTrial(sequence: NbackWord[], index: number, n: number = N_BACK_N): boolean {
  return index >= n && sequence[index] === sequence[index - n];
}
