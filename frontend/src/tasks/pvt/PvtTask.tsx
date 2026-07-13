import { useEffect, useRef, useState } from "react";
import type { TrialCreate } from "../../types/session";
import { usePvtTask } from "./usePvtTask";

interface PvtTaskProps {
  onComplete: (trials: TrialCreate[]) => void;
}

// Live counter shown while the stimulus is up, purely visual feedback for
// the participant (classic PVT UI). The recorded reaction_time_ms always
// comes from performance.now() deltas inside usePvtTask, never from this
// display value.
function useLiveCounterMs(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    startRef.current = performance.now();
    let frameId: number;
    const tick = () => {
      setElapsed(performance.now() - startRef.current);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [active]);

  return elapsed;
}

export function PvtTask({ onComplete }: PvtTaskProps) {
  const { phase, trials, trialsCompleted, totalTrials, lastResult, start } = usePvtTask();
  const liveMs = useLiveCounterMs(phase === "stimulus");
  const completedRef = useRef(false);

  useEffect(() => {
    if (phase === "finished" && !completedRef.current) {
      completedRef.current = true;
      onComplete(trials);
    }
  }, [phase, trials, onComplete]);

  if (phase === "idle") {
    return (
      <div className="pvt-screen">
        <h2>Psychomotor Vigilance Task</h2>
        <p>
          Watch for the counter to appear, then press <kbd>Space</kbd> as fast as you can.
        </p>
        <p>Responding before it appears counts as a false start — wait for it.</p>
        <button onClick={start}>Start</button>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="pvt-screen">
        <p>Task complete.</p>
      </div>
    );
  }

  return (
    <div className="pvt-screen">
      <p className="pvt-progress">
        Trial {Math.min(trialsCompleted + 1, totalTrials)} / {totalTrials}
      </p>
      <div className="pvt-stimulus-area">
        {phase === "stimulus" ? (
          <span className="pvt-counter">{Math.round(liveMs)}</span>
        ) : (
          <span className="pvt-waiting">Wait for it&hellip;</span>
        )}
      </div>
      {lastResult && (
        <p className="pvt-feedback">
          {lastResult.error_type === "random" && "Too soon — false start"}
          {lastResult.error_type === "none" && "No response"}
          {lastResult.accuracy && lastResult.reaction_time_ms !== null && `${Math.round(lastResult.reaction_time_ms)} ms`}
        </p>
      )}
    </div>
  );
}
