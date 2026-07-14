import { useCallback, useEffect, useReducer, useRef } from "react";
import type { TrialCreate, ErrorType } from "../../types/session";
import {
  MATCH_KEY,
  NO_MATCH_KEY,
  N_BACK_N,
  RESPONSE_WINDOW_MS,
  STIMULUS_DISPLAY_MS,
  TRIAL_COUNT,
  generateSequence,
  isTargetTrial,
  type NbackLetter,
} from "./nbackConfig";

export type NbackPhase = "idle" | "stimulus" | "blank" | "finished";

interface TrialResult {
  reaction_time_ms: number | null;
  accuracy: boolean;
  error_type: ErrorType | null;
}

interface NbackState {
  phase: NbackPhase;
  sequence: NbackLetter[];
  trials: TrialCreate[];
  lastResult: TrialResult | null;
}

type NbackAction =
  | { type: "START"; sequence: NbackLetter[] }
  | { type: "STIMULUS_HIDDEN" }
  | { type: "RECORD_RESULT"; result: TrialResult };

const initialState: NbackState = { phase: "idle", sequence: [], trials: [], lastResult: null };

function reducer(state: NbackState, action: NbackAction): NbackState {
  switch (action.type) {
    case "START":
      return { phase: "stimulus", sequence: action.sequence, trials: [], lastResult: null };
    case "STIMULUS_HIDDEN":
      return state.phase === "stimulus" ? { ...state, phase: "blank" } : state;
    case "RECORD_RESULT": {
      // Guard against a stray timer firing after the phase already moved on
      // (e.g. a keypress and the timeout racing each other).
      if (state.phase !== "stimulus" && state.phase !== "blank") return state;
      const trial: TrialCreate = {
        task_type: "nback",
        trial_number: state.trials.length + 1,
        ...action.result,
      };
      const trials = [...state.trials, trial];
      return {
        ...state,
        phase: trials.length >= state.sequence.length ? "finished" : "stimulus",
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

  // Stimulus -> blank: the letter is only visible for STIMULUS_DISPLAY_MS,
  // but the response window (and the reaction-time clock) keeps running
  // through the blank portion — matches standard n-back presentation.
  useEffect(() => {
    if (state.phase !== "stimulus") return;
    stimulusOnsetRef.current = performance.now();
    const id = window.setTimeout(() => dispatch({ type: "STIMULUS_HIDDEN" }), STIMULUS_DISPLAY_MS);
    return () => window.clearTimeout(id);
  }, [state.phase, state.trials.length]);

  // Blank -> timeout: no response anywhere in the window counts as a
  // non-response (mirrors PVT's timeout -> error_type "none").
  useEffect(() => {
    if (state.phase !== "blank") return;
    const onset = stimulusOnsetRef.current ?? performance.now();
    const remaining = Math.max(RESPONSE_WINDOW_MS - (performance.now() - onset), 0);
    const id = window.setTimeout(() => {
      stimulusOnsetRef.current = null;
      dispatch({ type: "RECORD_RESULT", result: { reaction_time_ms: null, accuracy: false, error_type: "none" } });
    }, remaining);
    return () => window.clearTimeout(id);
  }, [state.phase, state.trials.length]);

  // F = match, J = no match — a forced choice on every trial (see
  // nbackConfig.ts rationale), valid during both the visible and blank
  // portions of the response window.
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.code !== MATCH_KEY && e.code !== NO_MATCH_KEY) return;
      if (state.phase !== "stimulus" && state.phase !== "blank") return;
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
    currentLetter: state.phase === "stimulus" ? state.sequence[state.trials.length] : null,
    n: N_BACK_N,
    start,
  };
}
