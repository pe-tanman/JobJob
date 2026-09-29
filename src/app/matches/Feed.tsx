"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { ArrowSquareOut, ArrowsClockwise, CloudSun, Compass, ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { feedbackAction, refreshMatchesAction } from "@/app/actions";

export type FeedItem = {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  payText: string | null;
  active: boolean;
  reason: string;
  explore: boolean;
  status: "new" | "interested" | "dismissed" | "applied";
  createdAt: string;
};

const REASONS = [
  ["role", "Wrong kind of work"],
  ["location", "Location"],
  ["timing", "Timing"],
  ["too_senior", "Too advanced"],
  ["company", "This company"],
] as const;
type Reason = (typeof REASONS)[number][0];

export function Feed({ initial }: { initial: FeedItem[] }) {
  const [items, setItems] = useState(initial);
  const [announce, setAnnounce] = useState("");
  const [error, setError] = useState("");
  const [refreshing, startRefresh] = useTransition();
  const router = useRouter();

  const fresh = items.filter((i) => i.status === "new");
  const saved = items.filter((i) => i.status === "interested" || i.status === "applied");

  async function send(item: FeedItem, signal: "interested" | "dismissed" | "applied", reason?: Reason) {
    setError("");
    const before = items;
    // Optimistic: the card moves immediately; we roll back if the server says no.
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, status: signal } : i)));
    const res = await feedbackAction({ jobId: item.id, signal, reason });
    if (!res.ok) {
      setItems(before);
      setError(res.error);
      return;
    }
    setAnnounce(
      signal === "interested"
        ? `Saved ${item.title}. We will send more like it.`
        : signal === "applied"
          ? `Marked ${item.title} as applied.`
          : `Hid ${item.title}. We will send fewer like it.`,
    );
  }

  return (
    <div className="grid gap-10">
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {error && (
        <p className="card border-accent p-4 font-medium text-accent-ink" role="alert">
          {error}
        </p>
      )}

      <section aria-labelledby="new-heading" className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="new-heading" className="text-xl font-semibold">
            New for you <span className="font-normal text-ink-muted">({fresh.length})</span>
          </h2>
          <button
            type="button"
            className="btn-quiet"
            disabled={refreshing}
            onClick={() =>
              startRefresh(async () => {
                const { added } = await refreshMatchesAction();
                setAnnounce(added ? `${added} new matches added.` : "Nothing new yet.");
                router.refresh();
              })
            }
          >
            <ArrowsClockwise size={18} aria-hidden className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Looking" : "Find more"}
          </button>
        </div>

        {fresh.length === 0 ? (
          <div className="card grid justify-items-start gap-3 p-8">
            <CloudSun size={40} weight="duotone" className="text-accent-ink" aria-hidden />
            <p className="text-lg font-semibold">Nothing new under this sky yet.</p>
            <p className="max-w-[55ch] text-ink-muted">
              We check thousands of postings every 6 hours and email you when one fits. You can also widen your
              filters in Settings.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3">
            <AnimatePresence initial={false}>
              {fresh.map((item) => (
                <MatchCard key={item.id} item={item} onSignal={send} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      {saved.length > 0 && (
        <section aria-labelledby="saved-heading" className="grid gap-4">
          <h2 id="saved-heading" className="text-xl font-semibold">
            You are interested in <span className="font-normal text-ink-muted">({saved.length})</span>
          </h2>
          <ul className="grid gap-2">
            {saved.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] bg-sky-1 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-ink-muted">
                    {item.company}
                    {item.status === "applied" ? ", applied" : ""}
                  </p>
                </div>
                <a href={item.url} target="_blank" rel="noreferrer" className="btn-quiet">
                  Open posting <ArrowSquareOut size={18} aria-hidden />
                  <span className="sr-only"> for {item.title} (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MatchCard({
  item,
  onSignal,
}: {
  item: FeedItem;
  onSignal: (item: FeedItem, signal: "interested" | "dismissed" | "applied", reason?: Reason) => Promise<void>;
}) {
  const reduce = useReducedMotion();
  const [askReason, setAskReason] = useState(false);
  const [reason, setReason] = useState<string>("");
  const headingId = `job-${item.id}`;

  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="card grid gap-4 p-5 md:p-6"
      aria-labelledby={headingId}
    >
      <div className="grid gap-1.5">
        {item.explore && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-accent-ink">
            <Compass size={16} aria-hidden /> Something different
          </p>
        )}
        <h3 id={headingId} className="text-lg leading-snug font-semibold text-balance">
          {item.title}
        </h3>
        <p className="text-ink-muted">
          {item.company}
          {item.location ? `, ${item.location}` : ""}
        </p>
        {item.payText && <p className="font-mono text-sm text-ink-muted">{item.payText}</p>}
        <p className="text-sm text-ink-muted">{item.reason}</p>
        {!item.active && <p className="text-sm font-medium text-accent-ink">This posting may have closed.</p>}
      </div>

      {askReason ? (
        <div className="grid gap-3">
          <p id={`${headingId}-why`} className="field-label">
            What was off? <span className="font-normal text-ink-muted">(optional)</span>
          </p>
          <ToggleGroup.Root
            type="single"
            value={reason}
            onValueChange={setReason}
            aria-labelledby={`${headingId}-why`}
            className="flex flex-wrap gap-2"
          >
            {REASONS.map(([k, label]) => (
              <ToggleGroup.Item key={k} value={k} className="chip">
                {label}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void onSignal(item, "dismissed", (reason || undefined) as Reason | undefined)}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => onSignal(item, "interested")}>
            <ThumbsUp size={18} aria-hidden /> Interested
          </button>
          <button type="button" className="btn-quiet" onClick={() => setAskReason(true)}>
            <ThumbsDown size={18} aria-hidden /> Not for me
          </button>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
            onClick={() => void onSignal(item, "applied")}
          >
            Apply <ArrowSquareOut size={18} aria-hidden />
            <span className="sr-only"> to {item.title} (opens in a new tab)</span>
          </a>
        </div>
      )}
    </motion.li>
  );
}
