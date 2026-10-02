import { eq, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { schema } from "@/db/client";
import { roleLabel } from "@/rank/features";

const { jobs, jobFeatures } = schema;

/**
 * Experimental single-box search. The query is split into terms (quoted phrases kept whole);
 * every term must match somewhere. A term matches free text (title, company, location) or,
 * when it is a known word like "remote", "summer" or "ml", the matching Jev-labelled field.
 */

// Words that say nothing here, since everything listed is an internship.
const STOP = new Set(["a", "an", "and", "at", "for", "in", "of", "on", "or", "the", "to", "with", "intern", "interns", "internship", "internships", "job", "jobs", "role", "roles", "position", "positions", "opportunity", "opportunities"]);

const ROLE_WORDS: Record<string, string[]> = {
  software: ["software_engineering"], swe: ["software_engineering"], sde: ["software_engineering"], developer: ["software_engineering"], engineering: ["software_engineering", "hardware_electrical", "mechanical_aerospace_civil"], backend: ["software_engineering"], frontend: ["software_engineering"], fullstack: ["software_engineering"], mobile: ["software_engineering"],
  data: ["data_science_analytics"], analytics: ["data_science_analytics"], analyst: ["data_science_analytics", "finance_accounting", "consulting_strategy"],
  ml: ["machine_learning_ai"], ai: ["machine_learning_ai"], llm: ["machine_learning_ai"],
  security: ["infrastructure_security"], cybersecurity: ["infrastructure_security"], devops: ["infrastructure_security"], sre: ["infrastructure_security"], cloud: ["infrastructure_security"], infrastructure: ["infrastructure_security"],
  hardware: ["hardware_electrical"], electrical: ["hardware_electrical"], embedded: ["hardware_electrical"], firmware: ["hardware_electrical"],
  mechanical: ["mechanical_aerospace_civil"], aerospace: ["mechanical_aerospace_civil"], civil: ["mechanical_aerospace_civil"], manufacturing: ["mechanical_aerospace_civil"],
  quant: ["quant_trading"], trading: ["quant_trading"],
  research: ["research_science"], biotech: ["research_science"],
  product: ["product_management"], pm: ["product_management"],
  design: ["design_ux"], ux: ["design_ux"], ui: ["design_ux"],
  finance: ["finance_accounting"], accounting: ["finance_accounting"], banking: ["finance_accounting"],
  consulting: ["consulting_strategy"], strategy: ["consulting_strategy"],
  marketing: ["marketing_content"], content: ["marketing_content"],
  sales: ["sales_business_development"], partnerships: ["sales_business_development"],
  operations: ["operations_supply_chain"], ops: ["operations_supply_chain"], logistics: ["operations_supply_chain"],
  legal: ["people_legal_policy"], policy: ["people_legal_policy"], hr: ["people_legal_policy"], recruiting: ["people_legal_policy"],
};
const SEASON_WORDS: Record<string, string> = { summer: "summer", fall: "fall", autumn: "fall", winter: "winter_spring", spring: "winter_spring", "part-time": "year_round" };
const MODE_WORDS: Record<string, string> = { remote: "remote", hybrid: "hybrid", onsite: "onsite", "on-site": "onsite", "in-person": "onsite" };
const MODE_LABEL: Record<string, string> = { onsite: "In person", hybrid: "Hybrid", remote: "Remote" };
const SEASON_LABEL: Record<string, string> = { summer: "Summer", fall: "Fall term", winter_spring: "Winter or spring", year_round: "During the school year" };

/** How a term was read, so the page can show it back. */
export type Reading = { term: string; as: string[]; filter?: boolean };

export function tokenize(q: string): string[] {
  const out: string[] = [];
  for (const m of q.toLowerCase().matchAll(/"([^"]+)"|(\S+)/g)) {
    const t = (m[1] ?? m[2]).trim().replace(/^[,.;:!?]+|[,.;:!?]+$/g, "");
    if (t && !STOP.has(t)) out.push(t);
  }
  return out.slice(0, 8);
}

export function searchWhere(q: string): { where: SQL[]; readings: Reading[] } {
  const where: SQL[] = [];
  const readings: Reading[] = [];
  for (const term of tokenize(q)) {
    const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const any: SQL[] = [ilike(jobs.title, like), ilike(jobs.company, like), ilike(jobs.location, like)];
    const as: string[] = [];

    const roles = ROLE_WORDS[term];
    if (roles) {
      any.push(inArray(jobFeatures.roleFamily, roles));
      as.push(...roles.map(roleLabel));
    }
    const season = SEASON_WORDS[term];
    if (season) {
      any.push(eq(jobFeatures.season, season));
      as.push(SEASON_LABEL[season]);
    }
    const mode = MODE_WORDS[term];
    if (mode) {
      any.push(mode === "remote" ? sql`(${jobs.remote} OR ${jobFeatures.workMode} = 'remote')` : eq(jobFeatures.workMode, mode));
      as.push(MODE_LABEL[mode]);
    }

    // A few words are constraints, not text: postings rarely say "paid" or "visa" in the title.
    if (term === "paid") {
      where.push(ne(jobFeatures.paid, "unpaid"));
      readings.push({ term, as: ["Paid or pay not stated"], filter: true });
    } else if (term === "visa" || term === "sponsorship" || term === "sponsor" || term === "opt" || term === "cpt") {
      where.push(ne(jobFeatures.sponsorship, "excludes"));
      readings.push({ term, as: ["Open to visa sponsorship"], filter: true });
    } else {
      where.push(or(...any)!);
      if (as.length) readings.push({ term, as });
    }
  }
  return { where, readings };
}
