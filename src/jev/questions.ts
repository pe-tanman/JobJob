import { choice, noul, score } from "@typesafe-ai/sdk";

// Jev pass A: judgments about a posting that do not depend on who is reading it.
// They are computed once per posting and shared by every user, which is what keeps
// JetJob cheap. All questions go in one request: Jev answers them in parallel over
// the same state, and none of them depends on another's answer.
//
// State shape (see classifyJob.ts):
//   { posting: { title, company, location, pay, source, description } }
// Dates, pay arithmetic and location matching stay in code; Jev is not asked to do them.

export const ROLE_FAMILIES = {
  software_engineering: "Building software products: backend, frontend, full-stack, mobile, platform, SDE/SWE.",
  data_science_analytics: "Analyzing data, dashboards, statistics, business intelligence, data engineering pipelines.",
  machine_learning_ai: "Training, evaluating or deploying ML models; applied AI, ML research engineering, LLMs.",
  infrastructure_security: "Cloud, DevOps, SRE, IT, networking, or cybersecurity work.",
  hardware_electrical: "Electrical, embedded, firmware, chip design, FPGA, RF, or test engineering on hardware.",
  mechanical_aerospace_civil: "Mechanical, aerospace, civil, manufacturing, industrial, or chemical engineering.",
  quant_trading: "Quantitative research, trading, or quant development at a trading firm or fund.",
  research_science: "Lab or academic-style research in natural sciences, biotech, or health (not ML).",
  product_management: "Product or program management: owning roadmaps, specs, and cross-team delivery.",
  design_ux: "Product, UX, UI, visual, or interaction design and user research.",
  finance_accounting: "Investment banking, corporate finance, accounting, audit, tax, or asset management.",
  consulting_strategy: "Management or technology consulting, corporate strategy, business analysis.",
  marketing_content: "Marketing, growth, brand, communications, social media, or content writing.",
  sales_business_development: "Sales, partnerships, business development, or customer success.",
  operations_supply_chain: "Business operations, logistics, supply chain, or procurement.",
  people_legal_policy: "HR, recruiting, legal, compliance, public policy, or government affairs.",
  other: "None of the above clearly fits.",
} as const;
export type RoleFamily = keyof typeof ROLE_FAMILIES;

export const SEASONS = {
  summer: "A summer internship.",
  fall: "A fall (autumn) term internship or co-op.",
  winter_spring: "A winter or spring term internship or co-op.",
  year_round: "Part-time during the school year, or ongoing with no fixed term.",
  unclear: "The posting does not say when it takes place.",
} as const;
export type Season = keyof typeof SEASONS;

export const WORK_MODES = {
  onsite: "Work happens in person at a named office or site.",
  hybrid: "Some days in office, some remote.",
  remote: "Fully remote.",
  unclear: "The posting does not say.",
} as const;
export type WorkMode = keyof typeof WORK_MODES;

export const CLASS_YEARS = {
  early_undergrad: "Aimed at first or second year undergraduates (freshman, sophomore, first-year programs).",
  late_undergrad: "Aimed at third or fourth year undergraduates, or rising seniors.",
  graduate: "Requires or targets Master's or PhD students.",
  any: "Open to students at any stage, or the posting does not specify.",
} as const;
export type ClassYear = keyof typeof CLASS_YEARS;

export const jobQuestions = {
  is_internship: noul(
    "Is `posting` an internship, co-op, apprenticeship or other program for current students, rather than a regular full-time or experienced-hire role?",
    {
      true: "A position for current students or program participants, typically time-limited.",
      false: "A regular full-time, contract, or experienced-hire role, or a new-grad full-time job.",
    },
  ),
  is_legit: noul(
    "Does `posting` read like a genuine job posting from a real employer?",
    {
      true: "A real employer describing a real position.",
      false:
        "Spam, a multi-level-marketing pitch, a pay-to-apply scheme, a commission-only 'internship', or a posting with no identifiable work.",
    },
  ),
  role_family: choice("Which kind of work is `posting` mainly about?", ROLE_FAMILIES),
  season: choice("When does the internship in `posting` take place?", SEASONS),
  work_mode: choice("What is the work arrangement for `posting`?", WORK_MODES),
  paid: choice("Is the internship in `posting` paid?", {
    paid: "It states pay, a salary, an hourly rate, or a stipend, or clearly implies the role is paid.",
    unpaid: "It says the role is unpaid, volunteer, or for academic credit only.",
    unclear: "Pay is not mentioned.",
  }),
  sponsorship: choice(
    "What does `posting` say about work authorization or visa sponsorship for international students?",
    {
      offers: "It offers visa sponsorship or welcomes CPT/OPT and international students.",
      excludes: "It says sponsorship is not available or requires existing work authorization.",
      unclear: "It does not address work authorization.",
    },
  ),
  citizenship_required: noul(
    "Does `posting` require US citizenship, US person status, or a security clearance?",
  ),
  class_year: choice("Which students is `posting` aimed at?", CLASS_YEARS),
  student_friendliness: score(
    "How well does `posting` suit a student with little or no prior professional experience?",
    [
      "Expects several years of professional experience; not realistic for a student.",
      "Expects substantial prior internships or specialized expertise.",
      "Expects relevant coursework or projects; some prior experience helps.",
      "Explicitly welcomes students with little experience and focuses on potential.",
    ],
  ),
  learning_support: score("How much mentorship and learning support does `posting` describe?", [
    "No mention of mentorship, training, or learning.",
    "Brief mention of learning or a team to support the intern.",
    "A named mentor, structured onboarding, or regular feedback.",
    "A structured program: mentor, cohort, training curriculum, and events.",
  ]),
} as const;

export type JobAnswers = {
  [K in keyof typeof jobQuestions]: import("@typesafe-ai/sdk").ResultFor<(typeof jobQuestions)[K]>;
};

/** Pass B: personal fit. Built per request because it references each posting by key. */
export function fitQuestions(jobKey: string) {
  return {
    [`interest_${jobKey}`]: score(
      `How closely does the work described in \`postings.${jobKey}\` match what \`student.interests\` says the student wants to do?`,
      [
        "Unrelated to what the student describes wanting.",
        "Loosely related; shares a broad field but not the kind of work described.",
        "Related; overlaps with some of the student's stated interests.",
        "Closely matches one of the student's stated interests.",
        "Almost exactly the kind of work the student describes.",
      ],
    ),
    [`skills_${jobKey}`]: score(
      `How well do \`student.skills\` and \`student.year\` meet what \`postings.${jobKey}\` asks applicants to have?`,
      [
        "The student lacks most of what the posting requires.",
        "The student has some requirements but misses key ones.",
        "The student meets most stated requirements.",
        "The student meets or exceeds the stated requirements.",
      ],
    ),
  };
}
