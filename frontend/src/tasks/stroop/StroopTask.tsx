import { useEffect, useRef } from "react";
import type { TrialCreate } from "../../types/session";
import { COLORS, COLOR_HEX, COLOR_WORDS, RESPONSE_KEYS } from "./stroopConfig";
import { useStroopTask } from "./useStroopTask";

interface StroopTaskProps {
  onComplete: (trials: TrialCreate[]) => void;
}

export function StroopTask({ onComplete }: StroopTaskProps) {
  const { phase, trials, trialsCompleted, totalTrials, lastResult, currentInkColor, currentWordColor, start } =
    useStroopTask();
  const completedRef = useRef(false);

  useEffect(() => {
    if (phase === "finished" && !completedRef.current) {
      completedRef.current = true;
      onComplete(trials);
    }
  }, [phase, trials, onComplete]);

  // Always-visible key legend — see stroopConfig.ts rationale (the mapping
  // is arbitrary, not first-letter mnemonics, so it isn't meant to be
  // memorized ahead of time).
  const legend = (
    <div className="stroop-legend">
      {COLORS.map((color) => (
        <span key={color} className="stroop-legend-item">
          <kbd>{RESPONSE_KEYS[color].replace("Key", "")}</kbd>
          <span className="stroop-swatch" style={{ backgroundColor: COLOR_HEX[color] }} />
        </span>
      ))}
    </div>
  );

  if (phase === "idle") {
    return (
      <div className="stroop-screen">
        <h2>Stroop Task</h2>
        <p>A color word will appear. Press the key for the ink color it's printed in — ignore what the word says.</p>
        {legend}
        <button onClick={start}>Start</button>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="stroop-screen">
        <p>Task complete.</p>
      </div>
    );
  }

  return (
    <div className="stroop-screen">
      <p className="stroop-progress">
        Trial {Math.min(trialsCompleted + 1, totalTrials)} / {totalTrials}
      </p>
      <div className="stroop-stimulus-area">
        {phase === "stimulus" && currentInkColor && currentWordColor ? (
          <span className="stroop-word" style={{ color: COLOR_HEX[currentInkColor] }}>
            {COLOR_WORDS[currentWordColor]}
          </span>
        ) : (
          <span className="stroop-fixation">+</span>
        )}
      </div>
      {legend}
      {lastResult && (
        <p className="stroop-feedback">
          {lastResult.error_type === "none" ? "No response" : lastResult.accuracy ? "Correct" : "Incorrect"}
        </p>
      )}
    </div>
  );
}
