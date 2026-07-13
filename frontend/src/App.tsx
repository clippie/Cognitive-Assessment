import { useState } from "react";
import { submitSession } from "./api/sessions";
import { ApiError } from "./api/client";
import { SessionSetupForm, type SessionSetupValues } from "./components/SessionSetupForm";
import { SessionSubmit } from "./components/SessionSubmit";
import { PvtTask } from "./tasks/pvt/PvtTask";
import type { TrialCreate } from "./types/session";

type Stage = "setup" | "task" | "submit";
type SubmitStatus = "idle" | "submitting" | "success" | "error";

export default function App() {
  const [stage, setStage] = useState<Stage>("setup");
  const [setupValues, setSetupValues] = useState<SessionSetupValues | null>(null);
  const [trials, setTrials] = useState<TrialCreate[]>([]);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleSetupSubmit(values: SessionSetupValues) {
    setSetupValues(values);
    setStage("task");
  }

  function handleTaskComplete(completedTrials: TrialCreate[]) {
    setTrials(completedTrials);
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
      {stage === "task" && <PvtTask onComplete={handleTaskComplete} />}
      {stage === "submit" && (
        <SessionSubmit onSubmit={handleFinalSubmit} status={submitStatus} errorMessage={submitError} />
      )}
    </main>
  );
}
