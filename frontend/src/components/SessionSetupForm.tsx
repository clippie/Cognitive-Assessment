import { useState } from "react";
import type { ContextTag, TimeZone } from "../types/session";
import { KssRating } from "./KssRating";
import { CheckboxGroup, type CheckboxOption } from "./CheckboxGroup";
import { HoursSlider } from "./HoursSlider";

export interface SessionSetupValues {
  user_id: string;
  context_tag: ContextTag;
  kss_pre: number;
  sleep_hours: number;
  hours_since_waking: number;
  timezone: TimeZone;
}

interface SessionSetupFormProps {
  onSubmit: (values: SessionSetupValues) => void;
}

const CONTEXT_TAG_OPTIONS: CheckboxOption<ContextTag>[] = [
  { value: "morning", label: "Morning" },
  { value: "pre_work", label: "Pre-work" },
  { value: "post_work", label: "Post-work" },
  { value: "pre_sleep", label: "Pre-sleep" },
  { value: "other", label: "Other" },
];

const TIME_ZONE_OPTIONS: CheckboxOption<TimeZone>[] = [
  { value: "EST", label: "EST" },
  { value: "CST", label: "CST" },
  { value: "MST", label: "MST" },
  { value: "PST", label: "PST" },
];

export function SessionSetupForm({ onSubmit }: SessionSetupFormProps) {
  const [userId, setUserId] = useState("");
  const [contextTag, setContextTag] = useState<ContextTag | null>(null);
  const [kssPre, setKssPre] = useState<number | null>(null);
  // Sliders default to 0, which is a legitimate value (e.g. "just woke up" for
  // hours_since_waking) — so 0 can't double as "untouched." Per project decision,
  // a slider left at 0 is treated as not yet answered and blocks submission,
  // same as the unchecked context/timezone groups below.
  const [sleepHours, setSleepHours] = useState(0);
  const [hoursSinceWaking, setHoursSinceWaking] = useState(0);
  const [timezone, setTimezone] = useState<TimeZone | null>(null);

  const canSubmit =
    userId.trim().length > 0 &&
    contextTag !== null &&
    kssPre !== null &&
    sleepHours !== 0 &&
    hoursSinceWaking !== 0 &&
    timezone !== null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || contextTag === null || kssPre === null || timezone === null) return;
    onSubmit({
      user_id: userId.trim(),
      context_tag: contextTag,
      kss_pre: kssPre,
      sleep_hours: sleepHours,
      hours_since_waking: hoursSinceWaking,
      timezone,
    });
  }

  return (
    <form className="session-setup-form" onSubmit={handleSubmit}>
      <h2>Before you start</h2>

      <label>
        User ID
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="e.g. caden" required />
      </label>

      <CheckboxGroup legend="Context" options={CONTEXT_TAG_OPTIONS} value={contextTag} onChange={setContextTag} />

      <HoursSlider label="Hours of sleep last night" value={sleepHours} onChange={setSleepHours} />

      <HoursSlider label="Hours since waking" value={hoursSinceWaking} onChange={setHoursSinceWaking} />

      <CheckboxGroup legend="Time zone" options={TIME_ZONE_OPTIONS} value={timezone} onChange={setTimezone} />

      <KssRating label="Sleepiness right now (1 = alert, 9 = fighting sleep)" value={kssPre} onChange={setKssPre} />

      <button type="submit" disabled={!canSubmit}>
        Continue to task
      </button>
    </form>
  );
}
