"use client";

import { Faders } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";

/**
 * Filters live in one <details>. Closed by default so phones see results first;
 * opened on wider screens where it becomes a sidebar. Works without script (closed).
 */
export function FilterDisclosure({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      if (ref.current && mq.matches) ref.current.open = true;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <details ref={ref} className="group card md:border-0 md:bg-transparent md:shadow-none">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-card)] px-4 font-semibold md:px-0 [&::-webkit-details-marker]:hidden">
        <Faders size={20} aria-hidden />
        Filters
        {activeCount > 0 && <span className="text-ink-muted font-normal">({activeCount} on)</span>}
      </summary>
      <div className="px-4 pb-5 md:px-0">{children}</div>
    </details>
  );
}
