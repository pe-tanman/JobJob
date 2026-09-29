"use client";

import { BookmarkSimple, EyeSlash } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { browseSignalAction } from "@/app/actions";

type State = "none" | "interested" | "dismissed";

export function RowActions({ jobId, title, initial }: { jobId: string; title: string; initial: State }) {
  const [state, setState] = useState<State>(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const send = (signal: "interested" | "dismissed") =>
    start(async () => {
      setError("");
      const before = state;
      setState(signal);
      const res = await browseSignalAction({ jobId, signal });
      if (!res.ok) {
        setState(before);
        setError(res.error);
      }
    });

  if (state === "dismissed") {
    return (
      <p className="text-sm text-ink-muted" role="status">
        Hidden. We will show fewer like this in your matches.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={state === "interested" ? "btn-primary min-h-10 px-4 text-sm" : "btn-quiet min-h-10 px-4 text-sm"}
        aria-pressed={state === "interested"}
        disabled={pending || state === "interested"}
        onClick={() => send("interested")}
      >
        <BookmarkSimple size={16} weight={state === "interested" ? "fill" : "regular"} aria-hidden />
        {state === "interested" ? "Saved" : "Save"}
        <span className="sr-only"> {title}</span>
      </button>
      {state !== "interested" && (
        <button type="button" className="btn-ghost min-h-10 px-3 text-sm" disabled={pending} onClick={() => send("dismissed")}>
          <EyeSlash size={16} aria-hidden />
          Not for me
          <span className="sr-only"> ({title})</span>
        </button>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
