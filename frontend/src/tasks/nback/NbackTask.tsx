import { useEffect, useRef } from "react";
import type { TrialCreate } from "../../types/session";
import { useNbackTask } from "./useNbackTask";

interface NbackTaskProps {
  onComplete: (trials: TrialCreate[]) => void;
}

export function NbackTask({ onComplete }: NbackTaskProps) {
  const { phase, trials, trialsCompleted, totalTrials, lastResult, currentLetter, n, start } = useNbackTask();
  const completedRef = useRef(false);

  useEffect(() => {
    if (phase === "finished" && !completedRef.current) {
      completedRef.current = true;
      onComplete(trials);
    }
  }, [phase, trials, onComplete]);

  if (phase === "idle") {
    return (
      <div className="nback-screen">
        <h2>{n}-Back Task</h2>
        <p>
          A letter will appear every couple of seconds. Press <kbd>F</kbd> if it matches the letter from {n} letters
          ago, or <kbd>J</kbd> if it doesn't.
        </p>
        <p>Respond on every letter, even if you're not sure — there's no benefit to waiting.</p>
        <button onClick={start}>Start</button>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="nback-screen">
        <p>Task complete.</p>
      </div>
    );
  }

  return (
    <div className="nback-screen">
      <p className="nback-progress">
        Trial {Math.min(trialsCompleted + 1, totalTrials)} / {totalTrials}
      </p>
      <div className="nback-stimulus-area">{currentLetter ?? ""}</div>
      {lastResult && (
        <p className="nback-feedback">
          {lastResult.error_type === "none" ? "No response" : lastResult.accuracy ? "Correct" : "Incorrect"}
        </p>
      )}
    </div>
  );
}
