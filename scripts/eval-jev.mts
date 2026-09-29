import "dotenv/config";
import { getJson } from "@/ingest/http";
import { htmlToText } from "@/ingest/normalize";
import { classifyJob, jobState, toFeatureRow } from "@/jev/classifyJob";
import { USD_PER_INPUT_TOKEN } from "@/jev/client";
import { jevMode } from "@/lib/env";

// Evaluates Jev pass A against a labeled sample built from live data:
//  - Internships from the Simplify list, labeled with its curated category and term.
//  - Negatives: regular full-time roles from public Greenhouse boards.
// These are "silver" labels (curated metadata, not hand labels). Good enough to
// catch regressions and tune thresholds; add hand-labeled cases to eval/cases.json
// for anything that matters more.
//
// npm run eval:jev -- [--n=150]

type Case = {
  state: ReturnType<typeof jobState>;
  expect: { is_internship: boolean; role?: string[]; season?: string };
};

const n = Number(process.argv.find((a) => a.startsWith("--n="))?.split("=")[1] ?? 150);

const ROLE_FROM_CATEGORY: Record<string, string[]> = {
  Software: ["software_engineering", "infrastructure_security"],
  "Software Engineering": ["software_engineering", "infrastructure_security"],
  "AI/ML/Data": ["machine_learning_ai", "data_science_analytics"],
  Quant: ["quant_trading"],
  Hardware: ["hardware_electrical", "mechanical_aerospace_civil"],
  Product: ["product_management", "design_ux"],
};

function seasonFromTerm(term: string): string | undefined {
  if (/^Summer/.test(term)) return "summer";
  if (/^Fall/.test(term)) return "fall";
  if (/^(Winter|Spring)/.test(term)) return "winter_spring";
  return undefined;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

async function buildCases(): Promise<Case[]> {
  type L = { company_name: string; title: string; locations: string[]; terms?: string[]; category?: string; active: boolean; is_visible: boolean };
  const listings = (await getJson<L[]>(
    "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json",
    { timeoutMs: 60_000 },
  ))!.filter((l) => l.active && l.is_visible && l.category && ROLE_FROM_CATEGORY[l.category]);

  const positives: Case[] = shuffle(listings)
    .slice(0, Math.ceil(n * 0.7))
    .map((l) => {
      const terms = l.terms ?? [];
      return {
        state: jobState({
          title: l.title,
          company: l.company_name,
          location: l.locations.join("; "),
          payText: null,
          source: "simplify",
          description: `Category: ${l.category}\nTerms: ${terms.join(", ")}`,
        }),
        expect: {
          is_internship: true,
          role: ROLE_FROM_CATEGORY[l.category!],
          season: terms.length === 1 ? seasonFromTerm(terms[0]!) : undefined,
        },
      };
    });

  const negatives: Case[] = [];
  for (const board of shuffle(["stripe", "figma", "datadog", "reddit", "duolingo", "robinhood"])) {
    const data = await getJson<{ jobs: { title: string; location?: { name?: string }; content?: string; company_name?: string }[] }>(
      `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`,
    );
    for (const j of shuffle(data?.jobs ?? [])) {
      if (/\b(intern|co-?op|student|new grad|university|apprentice)\b/i.test(j.title)) continue;
      negatives.push({
        state: jobState({
          title: j.title,
          company: j.company_name ?? board,
          location: j.location?.name ?? "",
          payText: null,
          source: "greenhouse",
          description: htmlToText(j.content),
        }),
        expect: { is_internship: false },
      });
      if (negatives.length >= Math.floor(n * 0.3)) break;
    }
    if (negatives.length >= Math.floor(n * 0.3)) break;
  }
  return shuffle([...positives, ...negatives]);
}

const mode = jevMode();
console.log(`[eval] Jev mode: ${mode}${mode === "offline" ? " (keyword stand-in; numbers are a baseline, not Jev)" : ""}`);
const cases = await buildCases();
console.log(`[eval] ${cases.length} cases`);

const tally = {
  is_internship: { ok: 0, total: 0 },
  role: { ok: 0, total: 0 },
  season: { ok: 0, total: 0 },
};
let tokens = 0;
let needsReview = 0;
const misses: string[] = [];
const started = Date.now();

await Promise.all(
  cases.map(async (c) => {
    const res = await classifyJob(c.state);
    tokens += res.inputTokens;
    const a = res.answers;
    if (toFeatureRow("x", "x", res).needsReview) needsReview++;

    const internOk = a.is_internship.noul >= 0.5 === c.expect.is_internship;
    tally.is_internship.total++;
    if (internOk) tally.is_internship.ok++;
    else misses.push(`is_internship ${a.is_internship.noul.toFixed(2)} vs ${c.expect.is_internship}: ${c.state.posting.title}`);

    if (c.expect.role) {
      tally.role.total++;
      if (c.expect.role.includes(a.role_family.choice)) tally.role.ok++;
      else misses.push(`role ${a.role_family.choice} vs ${c.expect.role.join("|")}: ${c.state.posting.title}`);
    }
    if (c.expect.season) {
      tally.season.total++;
      if (a.season.choice === c.expect.season) tally.season.ok++;
      else misses.push(`season ${a.season.choice} vs ${c.expect.season}: ${c.state.posting.title}`);
    }
  }),
);

const elapsed = (Date.now() - started) / 1000;
console.log("\nAccuracy");
for (const [k, v] of Object.entries(tally)) {
  console.log(`  ${k.padEnd(14)} ${((100 * v.ok) / Math.max(1, v.total)).toFixed(1)}%  (${v.ok}/${v.total})`);
}
console.log(`\nNeeds review: ${((100 * needsReview) / cases.length).toFixed(1)}%`);
console.log(`Input tokens: ${tokens} total, ${(tokens / cases.length).toFixed(0)} per posting`);
console.log(`Cost: $${(tokens * USD_PER_INPUT_TOKEN).toFixed(5)} total, $${((tokens / cases.length) * USD_PER_INPUT_TOKEN * 10_000).toFixed(3)} per 10k postings`);
console.log(`Wall time: ${elapsed.toFixed(1)}s for ${cases.length} postings`);
console.log(`\nSample misses:\n  ${misses.slice(0, 15).join("\n  ") || "none"}`);
process.exit(0);
