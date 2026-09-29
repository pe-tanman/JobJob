"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { CheckCircle } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { emailFeedbackAction } from "@/app/actions";

const REASONS = [
  ["role", "Wrong kind of work"],
  ["location", "Location"],
  ["timing", "Timing"],
  ["too_senior", "Too advanced"],
  ["company", "This company"],
] as const;

// Recorded from the browser, not on GET: mail security scanners open links
// without running scripts, so they cannot cast votes on the user's behalf.
export function EmailFeedback({ token, signal }: { token: string; signal: "interested" | "dismissed" }) {
  const [status, setStatus] = useState<"saving" | "saved" | "error">("saving");
  const [reason, setReason] = useState("");
  const [reasonSaved, setReasonSaved] = useState(false);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    emailFeedbackAction(token).then((r) => setStatus(r.ok ? "saved" : "error"));
  }, [token]);

  if (status === "error") {
    return (
      <div className="card grid gap-2 p-6" role="alert">
        <h1 className="text-2xl font-semibold">That did not go through</h1>
        <p className="text-ink-muted">Try the link again, or mark it on your Matches page.</p>
      </div>
    );
  }

  return (
    <div className="card grid gap-5 p-6" aria-busy={status === "saving"}>
      <div className="grid gap-2" role="status">
        <CheckCircle size={32} weight="duotone" className="text-accent-ink" aria-hidden />
        <h1 className="text-2xl font-semibold">
          {status === "saving" ? "Saving your answer" : signal === "interested" ? "Saved. We will send more like it." : "Got it. We will send fewer like it."}
        </h1>
      </div>

      {signal === "dismissed" && status === "saved" && !reasonSaved && (
        <div className="grid gap-3">
          <p id="why" className="field-label">
            What was off? <span className="font-normal text-ink-muted">(optional)</span>
          </p>
          <ToggleGroup.Root type="single" value={reason} onValueChange={setReason} aria-labelledby="why" className="flex flex-wrap gap-2">
            {REASONS.map(([k, label]) => (
              <ToggleGroup.Item key={k} value={k} className="chip">
                {label}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
          <button
            type="button"
            className="btn-primary justify-self-start"
            disabled={!reason}
            onClick={() =>
              emailFeedbackAction(token, reason as (typeof REASONS)[number][0]).then(() => setReasonSaved(true))
            }
          >
            Send
          </button>
        </div>
      )}
      {reasonSaved && <p role="status">Thanks, that helps.</p>}

      <a href="/matches" className="btn-quiet justify-self-start">
        See all matches
      </a>
    </div>
  );
}
