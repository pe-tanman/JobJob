/**
 * Hero entry: text rises in sequence so the eye reads headline, then subtext, then action.
 * Pure CSS (see .rise in globals.css) so the server HTML is visible immediately and
 * reduced-motion users never get an animation or a hydration mismatch.
 */
export function HeroReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div className="rise" style={{ "--rise-delay": `${delay}s` } as React.CSSProperties}>
      {children}
    </div>
  );
}

/**
 * Reveal as the element scrolls into view, with CSS scroll-driven animation (see .reveal).
 * Content is always present and visible without support, script, or motion permission.
 */
export function Reveal({ children, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return <div className={`reveal ${className ?? ""}`}>{children}</div>;
}
