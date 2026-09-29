import {
  CLASS_YEARS,
  ROLE_FAMILIES,
  SEASONS,
  WORK_MODES,
  type JobAnswers,
  type RoleFamily,
} from "./questions";
import type { JobState } from "./classifyJob";

// DEV-ONLY stand-in for Jev when no TYPESAFE_API_KEY is set. It returns the same
// typed shape using keyword rules so the rest of the pipeline can run locally.
// It is intentionally crude and is never used in production (see env.jevMode).

type Probs<K extends string> = Record<K, number>;

function choiceOf<K extends string>(labels: readonly K[], picked: K, strength = 0.7) {
  const rest = (1 - strength) / Math.max(1, labels.length - 1);
  const probabilities = Object.fromEntries(labels.map((l) => [l, l === picked ? strength : rest])) as Probs<K>;
  return { type: "choice" as const, choice: picked, confidence: strength, probabilities };
}

function scoreOf(levels: number, value: number) {
  const v = Math.max(0, Math.min(levels - 1, value));
  const lo = Math.floor(v);
  const hi = Math.min(levels - 1, lo + 1);
  const probabilities: Record<string, number> = {};
  const legend: Record<string, null> = {};
  for (let i = 0; i < levels; i++) {
    probabilities[i] = 0;
    legend[i] = null;
  }
  probabilities[hi] = v - lo;
  probabilities[lo] = (probabilities[lo] ?? 0) + 1 - (v - lo);
  return { type: "score" as const, score: v, confidence: 0.5, probabilities, legend };
}

const noul = (p: number) => ({ type: "noul" as const, noul: p });

const ROLE_RULES: [RoleFamily, RegExp][] = [
  ["quant_trading", /\b(quant|trading|trader)\b/i],
  ["machine_learning_ai", /\b(machine learning|ml|ai|deep learning|llm|computer vision|nlp)\b/i],
  ["data_science_analytics", /\b(data|analytics|analyst|business intelligence)\b/i],
  ["infrastructure_security", /\b(security|cyber|devops|sre|cloud|infrastructure|network|it support)\b/i],
  ["hardware_electrical", /\b(electrical|embedded|firmware|fpga|asic|hardware|rf|silicon|circuit)\b/i],
  ["mechanical_aerospace_civil", /\b(mechanical|aerospace|civil|manufacturing|industrial|chemical|structural)\b/i],
  ["software_engineering", /\b(software|swe|sde|developer|frontend|backend|full[- ]?stack|mobile|ios|android|engineer)\b/i],
  ["product_management", /\b(product manag|program manag|\bapm\b|\bpm\b)/i],
  ["design_ux", /\b(design|ux|ui|user research)\b/i],
  ["research_science", /\b(research|scientist|lab|biolog|chemistry|clinical)\b/i],
  ["finance_accounting", /\b(finance|accounting|audit|tax|investment|banking|treasury)\b/i],
  ["consulting_strategy", /\b(consult|strategy|business analyst)\b/i],
  ["marketing_content", /\b(marketing|brand|content|communications|social media|growth)\b/i],
  ["sales_business_development", /\b(sales|business development|partnerships|account)\b/i],
  ["operations_supply_chain", /\b(operations|supply chain|logistics|procurement)\b/i],
  ["people_legal_policy", /\b(hr|human resources|recruit|legal|policy|compliance)\b/i],
];

export function offlineClassify(state: JobState): JobAnswers {
  const p = state.posting;
  const title = p.title;
  const all = `${p.title}\n${p.location}\n${p.description}`;

  const intern = /\b(intern|internship|co-?op|student|apprentice)\b/i.test(title) ? 0.93 : 0.3;
  const role = ROLE_RULES.find(([, re]) => re.test(title))?.[0] ?? ROLE_RULES.find(([, re]) => re.test(all))?.[0] ?? "other";

  const season = /\bsummer\b/i.test(all)
    ? "summer"
    : /\bfall\b|\bautumn\b/i.test(all)
      ? "fall"
      : /\b(winter|spring)\b/i.test(all)
        ? "winter_spring"
        : /\bpart[- ]time\b|\byear[- ]round\b/i.test(all)
          ? "year_round"
          : "unclear";

  const mode = /\bhybrid\b/i.test(all) ? "hybrid" : /\bremote\b/i.test(p.location) ? "remote" : p.location ? "onsite" : "unclear";

  const paid = /\bunpaid\b|academic credit|volunteer/i.test(all)
    ? "unpaid"
    : p.pay || /\$\s?\d|hourly|stipend|salary|compensation/i.test(all)
      ? "paid"
      : "unclear";

  const sponsorship = /(not|unable to|cannot|will not)\s+(provide\s+|offer\s+)?sponsor/i.test(all)
    ? "excludes"
    : /\b(cpt|opt|sponsorship available|will sponsor|offers sponsorship)\b/i.test(all)
      ? "offers"
      : "unclear";

  const citizenship = /\b(u\.?s\.? citizen(ship)?|security clearance|clearance required|us person)\b/i.test(all) ? 0.85 : 0.08;

  const classYear = /\b(phd|ph\.d|master'?s|graduate student)\b/i.test(all)
    ? "graduate"
    : /\b(freshman|sophomore|first[- ]year|second[- ]year|explore|step)\b/i.test(all)
      ? "early_undergrad"
      : /\b(junior|senior|rising senior|third[- ]year)\b/i.test(all)
        ? "late_undergrad"
        : "any";

  const mentoring = /\bmentor|cohort|program|training\b/i.test(all) ? 2 : /\blearn/i.test(all) ? 1 : 0;

  return {
    is_internship: noul(intern),
    is_legit: noul(/\b(mlm|commission only|pay to apply|unpaid.*commission)\b/i.test(all) ? 0.15 : 0.92),
    role_family: choiceOf(Object.keys(ROLE_FAMILIES) as RoleFamily[], role, role === "other" ? 0.4 : 0.65),
    season: choiceOf(Object.keys(SEASONS) as (keyof typeof SEASONS)[], season),
    work_mode: choiceOf(Object.keys(WORK_MODES) as (keyof typeof WORK_MODES)[], mode),
    paid: choiceOf(["paid", "unpaid", "unclear"] as const, paid),
    sponsorship: choiceOf(["offers", "excludes", "unclear"] as const, sponsorship),
    citizenship_required: noul(citizenship),
    class_year: choiceOf(Object.keys(CLASS_YEARS) as (keyof typeof CLASS_YEARS)[], classYear),
    student_friendliness: scoreOf(4, intern > 0.5 ? 2.4 : 0.8),
    learning_support: scoreOf(4, mentoring),
  } as unknown as JobAnswers;
}

/** Keyword overlap stand-in for the pass B fit scores. */
export function offlineFit(interests: string, skills: string, posting: { title: string; description: string }) {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9+#]+/)
        .filter((w) => w.length > 2),
    );
  const text = words(`${posting.title} ${posting.description}`);
  const overlap = (a: Set<string>) => {
    if (a.size === 0) return 0.5;
    let hit = 0;
    for (const w of a) if (text.has(w)) hit++;
    return Math.min(1, hit / Math.min(a.size, 6));
  };
  return { interest: overlap(words(interests)), skills: overlap(words(skills)) };
}
