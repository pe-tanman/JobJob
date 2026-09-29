"use client";

import { ArrowLeft, ArrowRight, EnvelopeSimple, ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { previewAction, signupAction, type PreviewJob } from "@/app/actions";
import { AboutField, ConstraintsField, RolesField, WhenField, WhereField } from "@/components/PrefsFields";
import { EMPTY_PREFS, type Prefs } from "@/lib/prefs";

const STEPS = [
  { key: "roles", title: "What would you like to work on?" },
  { key: "when", title: "When are you free?" },
  { key: "where", title: "Where would you like to be?" },
  { key: "filters", title: "A few things to rule out" },
  { key: "about", title: "Tell us about you" },
  { key: "preview", title: "Here is what we would send today" },
  { key: "email", title: "Where should we send them?" },
] as const;

const DRAFT_KEY = "jj-onboarding";
type Vote = "interested" | "dismissed";

function readDraft(): Prefs {
  // Storage may be unavailable (private windows); the wizard works without it.
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return { ...EMPTY_PREFS, ...JSON.parse(raw) };
  } catch {}
  return EMPTY_PREFS;
}

const noopSubscribe = () => () => {};

/** The draft only exists in the browser, so the wizard renders client-side. */
export function Wizard() {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-8 px-4 pt-10 pb-16 md:pt-16" aria-busy="true">
        <div className="h-4 w-24 animate-pulse rounded-full bg-sky-2" />
        <div className="h-10 w-3/4 animate-pulse rounded-full bg-sky-2" />
        <div className="h-40 animate-pulse rounded-[var(--radius-card)] bg-sky-2" />
      </div>
    );
  }
  return <WizardSteps />;
}

function WizardSteps() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [prefs, setPrefs] = useState<Prefs>(readDraft);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const reduce = useReducedMotion();
  // Set when the user changes step. The new heading takes focus when it mounts
  // (after the exit animation), so keyboard and screen reader users land on it.
  const focusOnMount = useRef(false);
  const headingRef = (el: HTMLHeadingElement | null) => {
    if (el && focusOnMount.current) {
      focusOnMount.current = false;
      el.focus();
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  const go = (delta: number) => {
    focusOnMount.current = true;
    setDir(delta);
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + delta)));
  };

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-8 px-4 pt-10 pb-16 md:pt-16">
      <div className="grid gap-3">
        <p className="text-sm font-medium text-ink-muted" aria-live="polite">
          Step {step + 1} of {STEPS.length}
        </p>
        {/* Decorative progress; the text above carries the meaning. */}
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-accent" : "bg-line"}`}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.section
          key={current.key}
          custom={dir}
          initial={reduce ? false : { opacity: 0, x: dir * 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -32 }}
          transition={{ duration: reduce ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
          aria-labelledby="step-heading"
          className="grid gap-8"
        >
          <h1
            id="step-heading"
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl leading-tight font-semibold tracking-tight text-balance outline-none md:text-4xl"
          >
            {current.title}
          </h1>

          {current.key === "roles" && <RolesField value={prefs} onChange={setPrefs} />}
          {current.key === "when" && <WhenField value={prefs} onChange={setPrefs} />}
          {current.key === "where" && <WhereField value={prefs} onChange={setPrefs} />}
          {current.key === "filters" && <ConstraintsField value={prefs} onChange={setPrefs} />}
          {current.key === "about" && <AboutField value={prefs} onChange={setPrefs} />}
          {current.key === "preview" && <PreviewStep prefs={prefs} votes={votes} setVotes={setVotes} />}
          {current.key === "email" && <EmailStep prefs={prefs} votes={votes} />}
        </motion.section>
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-6">
        {step > 0 ? (
          <button type="button" className="btn-ghost" onClick={() => go(-1)}>
            <ArrowLeft size={18} aria-hidden />
            Back
          </button>
        ) : (
          <span />
        )}
        {!isLast && (
          <button type="button" className="btn-primary" onClick={() => go(1)}>
            {current.key === "about" && !prefs.interests.trim() && !prefs.skills.trim() ? "Skip for now" : "Continue"}
            <ArrowRight size={18} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

function PreviewStep({
  prefs,
  votes,
  setVotes,
}: {
  prefs: Prefs;
  votes: Record<string, Vote>;
  setVotes: (v: Record<string, Vote>) => void;
}) {
  const [state, setState] = useState<{ status: "loading" } | { status: "ready"; jobs: PreviewJob[] } | { status: "error"; message: string }>({
    status: "loading",
  });

  useEffect(() => {
    let alive = true;
    previewAction(prefs).then((res) => {
      if (!alive) return;
      setState("error" in res ? { status: "error", message: res.error } : { status: "ready", jobs: res.jobs });
    });
    return () => {
      alive = false;
    };
    // Preferences cannot change while this step is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.status === "loading") {
    return (
      <div className="grid gap-3" aria-busy="true" aria-label="Loading examples">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card grid gap-3 p-5">
            <div className="h-5 w-2/3 animate-pulse rounded-full bg-sky-2" />
            <div className="h-4 w-1/3 animate-pulse rounded-full bg-sky-2" />
            <div className="h-4 w-1/2 animate-pulse rounded-full bg-sky-2" />
          </div>
        ))}
      </div>
    );
  }
  if (state.status === "error") {
    return <p className="card p-5 text-ink-muted" role="alert">{state.message}</p>;
  }
  if (state.jobs.length === 0) {
    return (
      <div className="card grid gap-2 p-6">
        <p className="text-lg font-semibold">Nothing matches every answer right now.</p>
        <p className="text-ink-muted">
          New postings arrive every few hours. You can go back and widen a filter, or continue and we will email you when
          something fits.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      <p className="max-w-[60ch] text-ink-muted">
        These are real postings from today. Rate a few so your first email is already tuned. This is optional.
      </p>
      <ul className="grid gap-3">
        {state.jobs.map((j) => (
          <li key={j.id} className="card grid gap-3 p-5">
            <div className="grid gap-1">
              <a href={j.url} target="_blank" rel="noreferrer" className="text-lg leading-snug font-semibold underline-offset-4 hover:underline">
                {j.title}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <p className="text-ink-muted">
                {j.company}
                {j.location ? `, ${j.location}` : ""}
              </p>
              <p className="text-sm text-ink-muted">{j.reason}</p>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label={`Your take on ${j.title}`}>
              <VoteButton pressed={votes[j.id] === "interested"} onClick={() => setVotes({ ...votes, [j.id]: "interested" })}>
                <ThumbsUp size={18} aria-hidden /> Interested
              </VoteButton>
              <VoteButton pressed={votes[j.id] === "dismissed"} onClick={() => setVotes({ ...votes, [j.id]: "dismissed" })}>
                <ThumbsDown size={18} aria-hidden /> Not for me
              </VoteButton>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VoteButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} data-state={pressed ? "on" : "off"} className="chip" onClick={onClick}>
      {children}
    </button>
  );
}

function EmailStep({ prefs, votes }: { prefs: Prefs; votes: Record<string, Vote> }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ devLink?: string } | null>(null);
  const [pending, start] = useTransition();
  const id = useId();

  if (done) {
    return (
      <div className="card grid gap-3 p-6" role="status">
        <EnvelopeSimple size={32} className="text-accent-ink" aria-hidden />
        <p className="text-xl font-semibold">Check your inbox</p>
        <p className="text-ink-muted">
          We sent a link to <strong className="text-ink">{email}</strong>. Open it to confirm and see your matches.
        </p>
        {done.devLink && (
          <p className="text-sm text-ink-muted">
            Local development: <a className="font-medium text-accent-ink underline" href={done.devLink}>open the confirmation link</a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      noValidate
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const res = await signupAction({
            email,
            prefs,
            previewFeedback: Object.entries(votes).map(([jobId, signal]) => ({ jobId, signal })),
          });
          if (!res.ok) return setError(res.error);
          try {
            localStorage.removeItem(DRAFT_KEY);
          } catch {}
          setDone({ devLink: res.devLink });
        });
      }}
    >
      <div className="grid gap-2">
        <label htmlFor={id} className="field-label">
          Email
        </label>
        <p id={`${id}-help`} className="field-help">
          No password. We send a link to confirm. You can pause or unsubscribe any time.
        </p>
        <input
          id={id}
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
        />
        {error && (
          <p id={`${id}-error`} className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <button type="submit" className="btn-primary justify-self-start" disabled={pending}>
        {pending ? "Sending link" : "Send my link"}
      </button>
    </form>
  );
}
