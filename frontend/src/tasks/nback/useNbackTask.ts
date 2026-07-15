import { useCallback, useEffect, useReducer, useRef } from "react";
import type { TrialCreate, ErrorType } from "../../types/session";
import {
  MATCH_KEY,
  NO_MATCH_KEY,
  N_BACK_N,
  TRIAL_COUNT,
  TRIAL_DURATION_MS,
  generateSequence,
  isTargetTrial,
  type NbackWord,
} from "./nbackConfig";

export type NbackPhase = "idle" | "active" | "finished";

interface TrialResult {
  reaction_time_ms: number | null;
  accuracy: boolean;
  error_type: ErrorType | null;
}

interface NbackState {
  phase: NbackPhase;
  sequence: NbackWord[];
  trials: TrialCreate[];
  lastResult: TrialResult | null;
}

type NbackAction = { type: "START"; sequence: NbackWord[] } | { type: "RECORD_RESULT"; result: TrialResult };

const initialState: NbackState = { phase: "idle", sequence: [], trials: [], lastResult: null };

function reducer(state: NbackState, action: NbackAction): NbackState {
  switch (action.type) {
    case "START":
      return { phase: "active", sequence: action.sequence, trials: [], lastResult: null };
    case "RECORD_RESULT": {
      // Guard against a stray timer firing after the phase already moved on
      // (e.g. a keypress and the timeout racing each other).
      if (state.phase !== "active") return state;
      const trial: TrialCreate = {
        task_type: "nback",
        trial_number: state.trials.length + 1,
        ...action.result,
      };
      const trials = [...state.trials, trial];
      return {
        ...state,
        phase: trials.length >= state.sequence.length ? "finished" : "active",
        trials,
        lastResult: action.result,
      };
    }
    default:
      return state;
  }
}

export function useNbackTask() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stimulusOnsetRef = useRef<number | null>(null);

  // Each trial gets the full TRIAL_DURATION_MS to view the word and answer.
  // No response anywhere in that window counts as a non-response (mirrors
  // PVT/Stroop's timeout -> error_type "none"). Re-runs on every new trial
  // (state.trials.length changing is what restarts the countdown).
  useEffect(() => {
    if (state.phase !== "active") return;
    stimulusOnsetRef.current = performance.now();
    const id = window.setTimeout(() => {
      stimulusOnsetRef.current = null;
      dispatch({ type: "RECORD_RESULT", result: { reaction_time_ms: null, accuracy: false, error_type: "none" } });
    }, TRIAL_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [state.phase, state.trials.length]);

  // F = match, J = no match — a forced choice on every trial (see
  // nbackConfig.ts rationale), valid any time the word is on screen.
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.code !== MATCH_KEY && e.code !== NO_MATCH_KEY) return;
      if (state.phase !== "active") return;
      e.preventDefault();

      const onset = stimulusOnsetRef.current;
      const reactionTimeMs = onset !== null ? performance.now() - onset : null;
      stimulusOnsetRef.current = null;

      const respondedMatch = e.code === MATCH_KEY;
      const actualMatch = isTargetTrial(state.sequence, state.trials.length);
      const correct = respondedMatch === actualMatch;

      dispatch({
        type: "RECORD_RESULT",
        result: { reaction_time_ms: reactionTimeMs, accuracy: correct, error_type: correct ? null : "random" },
      });
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [state.phase, state.sequence, state.trials.length]);

  const start = useCallback(() => dispatch({ type: "START", sequence: generateSequence() }), []);

  return {
    phase: state.phase,
    trials: state.trials,
    lastResult: state.lastResult,
    trialsCompleted: state.trials.length,
    totalTrials: TRIAL_COUNT,
    currentWord: state.phase === "active" ? state.sequence[state.trials.length] : null,
    trialDurationMs: TRIAL_DURATION_MS,
    n: N_BACK_N,
    start,
  };
}
