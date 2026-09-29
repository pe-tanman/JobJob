"use client";

import { ArrowSquareOut, ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

// A working miniature of the real match card, not a picture of one. Visitors can
// press the buttons and see how a single answer changes what comes next.
// Example data only; it is labeled as such on the page.

const EXAMPLES = [
  {
    title: "Software Engineering Intern, Summer",
    company: "Northwind Robotics",
    location: "Austin, TX",
    reason: "Software engineering, matches what you said excites you, paid",
  },
  {
    title: "Data Analyst Intern",
    company: "Harbor Health",
    location: "Remote",
    reason: "Data and analytics, remote, strong mentorship",
  },
  {
    title: "Embedded Firmware Co-op, Fall",
    company: "Lumen Avionics",
    location: "Seattle, WA",
    reason: "Hardware and electrical, fall term, open to students without much experience",
  },
];

export function ExampleCard() {
  const [i, setI] = useState(0);
  const [note, setNote] = useState("");
  const reduce = useReducedMotion();
  const ex = EXAMPLES[i % EXAMPLES.length]!;

  const answer = (liked: boolean) => {
    setNote(liked ? `Saved. More like ${ex.company} coming.` : "Hidden. Fewer like that one.");
    setI((n) => n + 1);
  };

  return (
    <div className="grid gap-3">
      <AnimatePresence mode="wait" initial={false}>
        <motion.article
          key={i}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="card grid gap-4 p-6"
          aria-label="Example match"
        >
          <div className="grid gap-1.5">
            <h3 className="text-lg leading-snug font-semibold">{ex.title}</h3>
            <p className="text-ink-muted">
              {ex.company}, {ex.location}
            </p>
            <p className="text-sm text-ink-muted">{ex.reason}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => answer(true)}>
              <ThumbsUp size={18} aria-hidden /> Interested
            </button>
            <button type="button" className="btn-quiet" onClick={() => answer(false)}>
              <ThumbsDown size={18} aria-hidden /> Not for me
            </button>
            <span className="btn-ghost pointer-events-none opacity-70" aria-hidden>
              Apply <ArrowSquareOut size={18} />
            </span>
          </div>
        </motion.article>
      </AnimatePresence>
      <p className="min-h-6 text-sm text-ink-muted" role="status">
        {note}
      </p>
    </div>
  );
}
