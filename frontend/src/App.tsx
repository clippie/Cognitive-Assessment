import { useState } from "react";
import { submitSession } from "./api/sessions";
import { ApiError } from "./api/client";
import { SessionSetupForm, type SessionSetupValues } from "./components/SessionSetupForm";
import { SessionSubmit } from "./components/SessionSubmit";
import { PvtTask } from "./tasks/pvt/PvtTask";
import { NbackTask } from "./tasks/nback/NbackTask";
import { StroopTask } from "./tasks/stroop/StroopTask";
import type { TrialCreate } from "./types/session";

// Task order follows Project_Management.md's cognitive-tasks table (PVT,
// N-back, Stroop). Each stage appends its own trials to `trials` rather than
// each task managing a slice of session state itself, since the session as a
// whole (not any one task) is the unit submitted to the backend.
type Stage = "setup" | "pvt" | "nback" | "stroop" | "submit";
type SubmitStatus = "idle" | "submitting" | "success" | "error";

export default function App() {
  const [stage, setStage] = useState<Stage>("setup");
  const [setupValues, setSetupValues] = useState<SessionSetupValues | null>(null);
  const [trials, setTrials] = useState<TrialCreate[]>([]);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleSetupSubmit(values: SessionSetupValues) {
    setSetupValues(values);
    setStage("pvt");
  }

  function handlePvtComplete(completedTrials: TrialCreate[]) {
    setTrials(completedTrials);
    setStage("nback");
  }

  function handleNbackComplete(completedTrials: TrialCreate[]) {
    setTrials((prev) => [...prev, ...completedTrials]);
    setStage("stroop");
  }

  function handleStroopComplete(completedTrials: TrialCreate[]) {
    setTrials((prev) => [...prev, ...completedTrials]);
    setStage("submit");
  }

  async function handleFinalSubmit(kssPost: number) {
    if (!setupValues) return;
    setSubmitStatus("submitting");
    setSubmitError(null);
    try {
      await submitSession({
        user_id: setupValues.user_id,
        context_tag: setupValues.context_tag,
        kss_pre: setupValues.kss_pre,
        kss_post: kssPost,
        sleep_hours: setupValues.sleep_hours,
        hours_since_waking: setupValues.hours_since_waking,
        timezone: setupValues.timezone,
        trials,
      });
      setSubmitStatus("success");
    } catch (err) {
      setSubmitStatus("error");
      setSubmitError(err instanceof ApiError ? JSON.stringify(err.body) : "Network error");
    }
  }

  return (
    <main className="app">
      <h1>Cognitive Assessment</h1>
      {stage === "setup" && <SessionSetupForm onSubmit={handleSetupSubmit} />}
      {stage === "pvt" && <PvtTask onComplete={handlePvtComplete} />}
      {stage === "nback" && <NbackTask onComplete={handleNbackComplete} />}
      {stage === "stroop" && <StroopTask onComplete={handleStroopComplete} />}
      {stage === "submit" && (
        <SessionSubmit onSubmit={handleFinalSubmit} status={submitStatus} errorMessage={submitError} />
      )}
    </main>
  );
}
