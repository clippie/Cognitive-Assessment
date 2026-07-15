import { useEffect, useRef, useState } from "react";
import type { TrialCreate } from "../../types/session";
import { useNbackTask } from "./useNbackTask";

interface NbackTaskProps {
  onComplete: (trials: TrialCreate[]) => void;
}

// Fraction of trial time remaining (1 -> 0), driving the countdown bar.
// Purely visual — the actual trial timeout lives in useNbackTask and runs
// off its own performance.now() delta, same separation PVT's live ms
// counter keeps between "what's scored" and "what's displayed". Restarts
// whenever `resetKey` (the completed-trial count) changes, since the phase
// value itself stays "active" across trials.
function useCountdownFraction(active: boolean, resetKey: number, durationMs: number): number {
  const [fraction, setFraction] = useState(1);
  const startRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setFraction(1);
      return;
    }
    startRef.current = performance.now();
    let frameId: number;
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      setFraction(Math.max(1 - elapsed / durationMs, 0));
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [active, resetKey, durationMs]);

  return fraction;
}

function KeyLegend({ n }: { n: number }) {
  return (
    <div className="nback-legend">
      <span className="nback-legend-item">
        <kbd>F</kbd> = matches {n} back
      </span>
      <span className="nback-legend-item">
        <kbd>J</kbd> = no match
      </span>
    </div>
  );
}

export function NbackTask({ onComplete }: NbackTaskProps) {
  const { phase, trials, trialsCompleted, totalTrials, lastResult, currentWord, trialDurationMs, n, start } =
    useNbackTask();
  const completedRef = useRef(false);
  const countdownFraction = useCountdownFraction(phase === "active", trialsCompleted, trialDurationMs);

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
          A word will appear. Press <kbd>F</kbd> if it matches the word from {n} words ago, or <kbd>J</kbd> if it
          doesn't. You'll have a few seconds each time — the bar below the word counts it down.
        </p>
        <KeyLegend n={n} />
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
      <div className="nback-stimulus-area">{currentWord ?? ""}</div>
      <div className="nback-timer-track">
        <div className="nback-timer-fill" style={{ width: `${countdownFraction * 100}%` }} />
      </div>
      <KeyLegend n={n} />
      {lastResult && (
        <p className="nback-feedback">
          {lastResult.error_type === "none" ? "No response" : lastResult.accuracy ? "Correct" : "Incorrect"}
        </p>
      )}
    </div>
  );
}
