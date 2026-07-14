import { useCallback, useEffect, useReducer, useRef } from "react";
import type { TrialCreate, ErrorType } from "../../types/session";
import {
  COLORS,
  ISI_MS,
  RESPONSE_KEYS,
  RESPONSE_TIMEOUT_MS,
  TRIAL_COUNT,
  generateSequence,
  type StroopColor,
  type StroopTrialSpec,
} from "./stroopConfig";

export type StroopPhase = "idle" | "isi" | "stimulus" | "finished";

interface TrialResult {
  reaction_time_ms: number | null;
  accuracy: boolean;
  error_type: ErrorType | null;
}

interface StroopState {
  phase: StroopPhase;
  sequence: StroopTrialSpec[];
  trials: TrialCreate[];
  lastResult: TrialResult | null;
}

type StroopAction =
  | { type: "START"; sequence: StroopTrialSpec[] }
  | { type: "STIMULUS_SHOWN" }
  | { type: "RECORD_RESULT"; result: TrialResult };

const initialState: StroopState = { phase: "idle", sequence: [], trials: [], lastResult: null };

function reducer(state: StroopState, action: StroopAction): StroopState {
  switch (action.type) {
    case "START":
      return { phase: "isi", sequence: action.sequence, trials: [], lastResult: null };
    case "STIMULUS_SHOWN":
      return state.phase === "isi" ? { ...state, phase: "stimulus" } : state;
    case "RECORD_RESULT": {
      // Guard against a stray timer firing after the phase already moved on
      // (e.g. a keypress and the timeout racing each other).
      if (state.phase !== "stimulus") return state;
      const trial: TrialCreate = {
        task_type: "stroop",
        trial_number: state.trials.length + 1,
        ...action.result,
      };
      const trials = [...state.trials, trial];
      return {
        ...state,
        phase: trials.length >= state.sequence.length ? "finished" : "isi",
        trials,
        lastResult: action.result,
      };
    }
    default:
      return state;
  }
}

function keyToColor(code: string): StroopColor | null {
  return (COLORS.find((c) => RESPONSE_KEYS[c] === code) as StroopColor | undefined) ?? null;
}

export function useStroopTask() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stimulusOnsetRef = useRef<number | null>(null);

  // ISI (fixation) -> stimulus: fixed delay, not randomized — see
  // stroopConfig.ts rationale (no anticipation failure mode to guard
  // against here, unlike PVT).
  useEffect(() => {
    if (state.phase !== "isi") return;
    const id = window.setTimeout(() => {
      stimulusOnsetRef.current = performance.now();
      dispatch({ type: "STIMULUS_SHOWN" });
    }, ISI_MS);
    return () => window.clearTimeout(id);
  }, [state.phase, state.trials.length]);

  // Stimulus -> timeout: no response within the window counts as a
  // non-response (error_type "none", mirrors PVT/N-back).
  useEffect(() => {
    if (state.phase !== "stimulus") return;
    const id = window.setTimeout(() => {
      stimulusOnsetRef.current = null;
      dispatch({ type: "RECORD_RESULT", result: { reaction_time_ms: null, accuracy: false, error_type: "none" } });
    }, RESPONSE_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [state.phase, state.trials.length]);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      const respondedColor = keyToColor(e.code);
      if (respondedColor === null) return;
      // A keypress during the ISI/fixation is ignored, not scored — see
      // stroopConfig.ts rationale (no "false start" concept in Stroop).
      if (state.phase !== "stimulus") return;
      e.preventDefault();

      const onset = stimulusOnsetRef.current;
      const reactionTimeMs = onset !== null ? performance.now() - onset : null;
      stimulusOnsetRef.current = null;

      const trialSpec = state.sequence[state.trials.length];
      const correct = respondedColor === trialSpec.inkColor;
      const errorType: ErrorType | null = correct ? null : trialSpec.congruent ? "random" : "interference";

      dispatch({
        type: "RECORD_RESULT",
        result: { reaction_time_ms: reactionTimeMs, accuracy: correct, error_type: errorType },
      });
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [state.phase, state.sequence, state.trials.length]);

  const start = useCallback(() => dispatch({ type: "START", sequence: generateSequence() }), []);

  const currentTrial = state.phase === "stimulus" ? state.sequence[state.trials.length] : null;

  return {
    phase: state.phase,
    trials: state.trials,
    lastResult: state.lastResult,
    trialsCompleted: state.trials.length,
    totalTrials: TRIAL_COUNT,
    currentInkColor: currentTrial?.inkColor ?? null,
    currentWordColor: currentTrial?.wordColor ?? null,
    start,
  };
}
