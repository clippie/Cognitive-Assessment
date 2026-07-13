import { useState } from "react";
import { KssRating } from "./KssRating";

interface SessionSubmitProps {
  onSubmit: (kssPost: number) => void;
  status: "idle" | "submitting" | "success" | "error";
  errorMessage: string | null;
}

export function SessionSubmit({ onSubmit, status, errorMessage }: SessionSubmitProps) {
  const [kssPost, setKssPost] = useState<number | null>(null);

  if (status === "success") {
    return (
      <div className="session-submit">
        <p>Session recorded. Thanks.</p>
      </div>
    );
  }

  return (
    <div className="session-submit">
      <h2>One last thing</h2>
      <KssRating label="Sleepiness right now (1 = alert, 9 = fighting sleep)" value={kssPost} onChange={setKssPost} />
      <button
        type="button"
        disabled={kssPost === null || status === "submitting"}
        onClick={() => kssPost !== null && onSubmit(kssPost)}
      >
        {status === "submitting" ? "Submitting…" : "Submit session"}
      </button>
      {status === "error" && <p className="error-message">{errorMessage ?? "Submission failed. Try again."}</p>}
    </div>
  );
}
