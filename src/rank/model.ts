import { FEATURE_LABELS, roleLabel, type FeatureVector } from "./features";

// Per-user online logistic regression. A few dozen named weights per user,
// updated with one SGD step per feedback event. No model calls, no training jobs:
// learning is free because Jev's per-job judgments never need to be recomputed.

export type Weights = Record<string, number>;

export type PriorInput = {
  roles: string[];
  seasons: string[];
  workModes: string[];
  paidOnly: boolean;
  needsSponsorship: boolean;
  hasInterests: boolean;
};

const ALL_ROLES = [
  "software_engineering",
  "data_science_analytics",
  "machine_learning_ai",
  "infrastructure_security",
  "hardware_electrical",
  "mechanical_aerospace_civil",
  "quant_trading",
  "research_science",
  "product_management",
  "design_ux",
  "finance_accounting",
  "consulting_strategy",
  "marketing_content",
  "sales_business_development",
  "operations_supply_chain",
  "people_legal_policy",
  "other",
];

/** Onboarding answers become the starting weights, so day-one matches already make sense. */
export function priorFromPreferences(p: PriorInput): Weights {
  const w: Weights = { bias: -1.2 };
  const anyRole = p.roles.length === 0;
  for (const r of ALL_ROLES) w[`role:${r}`] = anyRole ? 0 : p.roles.includes(r) ? 1.6 : -1.2;
  for (const s of ["summer", "fall", "winter_spring", "year_round"]) {
    w[`season:${s}`] = p.seasons.length === 0 || p.seasons.includes(s) ? 0.4 : -1;
  }
  w["season:unclear"] = 0;
  for (const m of ["onsite", "hybrid", "remote"]) {
    w[`mode:${m}`] = p.workModes.length === 0 || p.workModes.includes(m) ? 0.3 : -0.8;
  }
  w["mode:unclear"] = 0;
  w.paid = p.paidOnly ? 0.8 : 0.3;
  w.pay_listed = 0.2;
  w.student_friendly = 0.6;
  w.learning_support = 0.3;
  w.sponsorship_offered = p.needsSponsorship ? 0.9 : 0;
  w.interest_fit = p.hasInterests ? 2.2 : 0;
  w.skills_fit = p.hasInterests ? 0.8 : 0;
  w.fresh = 0.5;
  return w;
}

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function dot(w: Weights, x: FeatureVector): number {
  let z = 0;
  for (const k in x) z += (w[k] ?? 0) * x[k]!;
  return z;
}

export function predict(w: Weights, x: FeatureVector): number {
  return sigmoid(dot(w, x));
}

export type Signal = "interested" | "dismissed" | "applied";

const LEARNING_RATE = 0.35;
/** Pulls weights back toward the stated preferences so one click never overrides onboarding. */
const PRIOR_PULL = 0.02;

export function update(w: Weights, prior: Weights, x: FeatureVector, signal: Signal): Weights {
  const y = signal === "dismissed" ? 0 : 1;
  const importance = signal === "applied" ? 2 : 1;
  const err = y - predict(w, x);
  const next: Weights = { ...w };
  for (const k in x) next[k] = (next[k] ?? 0) + LEARNING_RATE * importance * err * x[k]!;
  for (const k in next) next[k] = next[k]! - PRIOR_PULL * (next[k]! - (prior[k] ?? 0));
  return next;
}

export type DismissReason = "location" | "role" | "company" | "too_senior" | "timing";

/** "Not for me" reasons act on the single feature the user named, on top of the SGD step. */
export function applyReason(w: Weights, x: FeatureVector, reason: DismissReason): Weights {
  const next = { ...w };
  const nudge = (prefix: string, by: number) => {
    const top = Object.entries(x)
      .filter(([k]) => k.startsWith(prefix))
      .sort((a, b) => b[1] - a[1])[0];
    if (top) next[top[0]] = (next[top[0]] ?? 0) + by * top[1];
  };
  if (reason === "role") nudge("role:", -0.8);
  if (reason === "timing") nudge("season:", -0.8);
  if (reason === "location") nudge("mode:", -0.5);
  if (reason === "too_senior") next.student_friendly = (next.student_friendly ?? 0) + 0.4;
  return next;
}

/** "Why this" line: the top positive contributions, in plain words. */
export function explain(w: Weights, x: FeatureVector, roleFamily: string): string {
  const parts = Object.entries(x)
    .filter(([k]) => FEATURE_LABELS[k])
    .map(([k, v]) => [k, (w[k] ?? 0) * v] as const)
    .filter(([, c]) => c > 0.15)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => FEATURE_LABELS[k]!);
  const role = roleFamily !== "other" ? roleLabel(roleFamily) : "";
  const text = [role, ...parts].filter(Boolean).join(", ");
  return text ? text[0]!.toUpperCase() + text.slice(1) : "A new posting worth a look";
}
