import { useState } from "react";
import type { ContextTag } from "../types/session";
import { KssRating } from "./KssRating";

export interface SessionSetupValues {
  user_id: string;
  context_tag: ContextTag;
  kss_pre: number;
  sleep_hours: number | null;
  hours_since_waking: number | null;
}

interface SessionSetupFormProps {
  onSubmit: (values: SessionSetupValues) => void;
}

const CONTEXT_TAGS: ContextTag[] = ["morning", "pre_work", "post_work", "pre_sleep", "other"];

export function SessionSetupForm({ onSubmit }: SessionSetupFormProps) {
  const [userId, setUserId] = useState("");
  const [contextTag, setContextTag] = useState<ContextTag>("morning");
  const [kssPre, setKssPre] = useState<number | null>(null);
  const [sleepHours, setSleepHours] = useState("");
  const [hoursSinceWaking, setHoursSinceWaking] = useState("");

  const canSubmit = userId.trim().length > 0 && kssPre !== null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || kssPre === null) return;
    onSubmit({
      user_id: userId.trim(),
      context_tag: contextTag,
      kss_pre: kssPre,
      sleep_hours: sleepHours === "" ? null : Number(sleepHours),
      hours_since_waking: hoursSinceWaking === "" ? null : Number(hoursSinceWaking),
    });
  }

  return (
    <form className="session-setup-form" onSubmit={handleSubmit}>
      <h2>Before you start</h2>

      <label>
        User ID
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="e.g. caden" required />
      </label>

      <label>
        Context
        <select value={contextTag} onChange={(e) => setContextTag(e.target.value as ContextTag)}>
          {CONTEXT_TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </label>

      <label>
        Hours of sleep last night (optional)
        <input
          type="number"
          min="0"
          max="24"
          step="0.5"
          value={sleepHours}
          onChange={(e) => setSleepHours(e.target.value)}
        />
      </label>

      <label>
        Hours since waking (optional)
        <input
          type="number"
          min="0"
          max="24"
          step="0.5"
          value={hoursSinceWaking}
          onChange={(e) => setHoursSinceWaking(e.target.value)}
        />
      </label>

      <KssRating label="Sleepiness right now (1 = alert, 9 = fighting sleep)" value={kssPre} onChange={setKssPre} />

      <button type="submit" disabled={!canSubmit}>
        Continue to task
      </button>
    </form>
  );
}
