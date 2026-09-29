import type { JobAnswers } from "@/jev/questions";

// A (user, job) pair becomes a sparse numeric vector. Jev's probabilities go in
// directly, so a posting that is 60% data science and 40% ML contributes to both.
// Every weight the model learns maps to one of these named features, which is
// what lets us explain a match in plain words without generating text.

export type FeatureVector = Record<string, number>;

export type FitScores = { interest: number; skills: number } | null;

const DAY = 24 * 60 * 60 * 1000;

export function featuresFor(
  answers: JobAnswers,
  job: { firstSeenAt: Date; payText: string | null },
  fit: FitScores,
  now = new Date(),
): FeatureVector {
  const f: FeatureVector = { bias: 1 };
  for (const [role, p] of Object.entries(answers.role_family.probabilities)) {
    if (p > 0.02) f[`role:${role}`] = p;
  }
  for (const [s, p] of Object.entries(answers.season.probabilities)) {
    if (p > 0.02) f[`season:${s}`] = p;
  }
  for (const [m, p] of Object.entries(answers.work_mode.probabilities)) {
    if (p > 0.02) f[`mode:${m}`] = p;
  }
  f.paid = answers.paid.probabilities.paid ?? 0;
  f.pay_listed = job.payText ? 1 : 0;
  f.student_friendly = answers.student_friendliness.score / 3;
  f.learning_support = answers.learning_support.score / 3;
  f.sponsorship_offered = answers.sponsorship.probabilities.offers ?? 0;
  // Fit comes from Jev pass B; before it runs we use a neutral 0.5 so it neither helps nor hurts.
  f.interest_fit = fit ? fit.interest : 0.5;
  f.skills_fit = fit ? fit.skills : 0.5;
  const ageDays = Math.max(0, (now.getTime() - job.firstSeenAt.getTime()) / DAY);
  f.fresh = Math.exp(-ageDays / 10);
  return f;
}

/** Human labels for the "why this" line. Only features a user would recognize. */
export const FEATURE_LABELS: Record<string, string> = {
  interest_fit: "matches what you said excites you",
  skills_fit: "fits your skills",
  paid: "paid",
  pay_listed: "pay is listed",
  student_friendly: "open to students without much experience",
  learning_support: "strong mentorship",
  sponsorship_offered: "offers visa sponsorship",
  fresh: "just posted",
  "mode:remote": "remote",
  "mode:hybrid": "hybrid",
  "mode:onsite": "in person",
  "season:summer": "summer",
  "season:fall": "fall term",
  "season:winter_spring": "winter or spring term",
  "season:year_round": "during the school year",
};

export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    software_engineering: "Software engineering",
    data_science_analytics: "Data and analytics",
    machine_learning_ai: "Machine learning and AI",
    infrastructure_security: "Infrastructure and security",
    hardware_electrical: "Hardware and electrical",
    mechanical_aerospace_civil: "Mechanical, aerospace and civil",
    quant_trading: "Quant and trading",
    research_science: "Research and science",
    product_management: "Product management",
    design_ux: "Design and UX",
    finance_accounting: "Finance and accounting",
    consulting_strategy: "Consulting and strategy",
    marketing_content: "Marketing and content",
    sales_business_development: "Sales and partnerships",
    operations_supply_chain: "Operations and supply chain",
    people_legal_policy: "People, legal and policy",
    other: "Other",
  };
  return labels[role] ?? role;
}
