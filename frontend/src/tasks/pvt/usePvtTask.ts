import { useCallback, useEffect, useReducer, useRef } from "react";
import type { TrialCreate, ErrorType } from "../../types/session";
import { RESPONSE_TIMEOUT_MS, TRIAL_COUNT, randomIsiMs } from "./pvtConfig";

export type PvtPhase = "idle" | "isi" | "stimulus" | "finished";

interface TrialResult {
  reaction_time_ms: number | null;
  accuracy: boolean;
  error_type: ErrorType | null;
}

interface PvtState {
  phase: PvtPhase;
  trials: TrialCreate[];
  lastResult: TrialResult | null;
}

type PvtAction = { type: "START" } | { type: "STIMULUS_SHOWN" } | { type: "RECORD_RESULT"; result: TrialResult };

const initialState: PvtState = { phase: "idle", trials: [], lastResult: null };

function reducer(state: PvtState, action: PvtAction): PvtState {
  switch (action.type) {
    case "START":
      return { ...initialState, phase: "isi" };
    case "STIMULUS_SHOWN":
      return state.phase === "isi" ? { ...state, phase: "stimulus" } : state;
    case "RECORD_RESULT": {
      // Guard against a stray timer firing after the phase already moved on
      // (e.g. a keypress and the timeout racing each other).
      if (state.phase !== "isi" && state.phase !== "stimulus") return state;
      const trial: TrialCreate = {
        task_type: "pvt",
        trial_number: state.trials.length + 1,
        ...action.result,
      };
      const trials = [...state.trials, trial];
      return {
        phase: trials.length >= TRIAL_COUNT ? "finished" : "isi",
        trials,
        lastResult: action.result,
      };
    }
    default:
      return state;
  }
}

export function usePvtTask() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stimulusOnsetRef = useRef<number | null>(null);

  // ISI -> stimulus: wait a random delay, then reveal the stimulus and record
  // its onset time (the reference point for reaction_time_ms).
  useEffect(() => {
    if (state.phase !== "isi") return;
    const isiId = window.setTimeout(() => {
      stimulusOnsetRef.current = performance.now();
      dispatch({ type: "STIMULUS_SHOWN" });
    }, randomIsiMs());
    return () => window.clearTimeout(isiId);
  }, [state.phase]);

  // Stimulus -> timeout: if no response arrives in time, the trial is a
  // non-response (accuracy: false, error_type: "none" — see pvtConfig.ts).
  useEffect(() => {
    if (state.phase !== "stimulus") return;
    const timeoutId = window.setTimeout(() => {
      stimulusOnsetRef.current = null;
      dispatch({ type: "RECORD_RESULT", result: { reaction_time_ms: null, accuracy: false, error_type: "none" } });
    }, RESPONSE_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [state.phase]);

  // Spacebar is the sole response key, standard for PVT (no discrimination
  // between response options — it's purely a speeded detection task).
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      e.preventDefault();

      if (state.phase === "isi") {
        // Responded before the stimulus appeared — false start.
        dispatch({ type: "RECORD_RESULT", result: { reaction_time_ms: null, accuracy: false, error_type: "random" } });
      } else if (state.phase === "stimulus") {
        const onset = stimulusOnsetRef.current;
        const reactionTimeMs = onset !== null ? performance.now() - onset : null;
        stimulusOnsetRef.current = null;
        dispatch({ type: "RECORD_RESULT", result: { reaction_time_ms: reactionTimeMs, accuracy: true, error_type: null } });
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [state.phase]);

  const start = useCallback(() => dispatch({ type: "START" }), []);

  return {
    phase: state.phase,
    trials: state.trials,
    lastResult: state.lastResult,
    trialsCompleted: state.trials.length,
    totalTrials: TRIAL_COUNT,
    start,
  };
}
