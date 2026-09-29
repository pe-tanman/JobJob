"use client";

import { useId, useState, useTransition } from "react";
import { signinAction } from "@/app/actions";

export function SigninForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ devLink?: string } | null>(null);
  const [pending, start] = useTransition();
  const id = useId();

  if (sent) {
    return (
      <div className="card grid gap-2 p-6" role="status">
        <p className="text-lg font-semibold">Check your inbox</p>
        <p className="text-ink-muted">If {email} has a JetJob account, a sign-in link is on its way.</p>
        {sent.devLink && (
          <a className="text-sm font-medium text-accent-ink underline" href={sent.devLink}>
            Local development: open the link
          </a>
        )}
      </div>
    );
  }

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const res = await signinAction({ email });
          if (!res.ok) return setError(res.error);
          setSent({ devLink: res.devLink });
        });
      }}
    >
      <div className="grid gap-2">
        <label htmlFor={id} className="field-label">
          Email
        </label>
        <input
          id={id}
          type="email"
          autoComplete="email"
          inputMode="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error && (
          <p id={`${id}-error`} className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <button type="submit" className="btn-primary justify-self-start" disabled={pending}>
        {pending ? "Sending link" : "Email me a link"}
      </button>
    </form>
  );
}
