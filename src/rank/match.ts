import { and, desc, eq, gte, inArray, lt, ne, notInArray, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { sha } from "@/ingest/normalize";
import type { JobAnswers } from "@/jev/questions";
import { scoreFit, type Fit } from "@/jev/scoreFit";
import { featuresFor } from "./features";
import { dot, explain, priorFromPreferences, type Weights } from "./model";

const { jobs, jobFeatures, fits, matches, userModels, preferences } = schema;

export type PrefsInput = {
  roles: string[];
  seasons: string[];
  workModes: string[];
  locations: string[];
  needsSponsorship: boolean;
  usCitizen: boolean;
  classYear: string;
  paidOnly: boolean;
  interests: string;
  skills: string;
};

export type RankedJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  payText: string | null;
  roleFamily: string;
  workMode: string;
  season: string;
  score: number;
  reason: string;
  explore: boolean;
  firstSeenAt: Date;
};

const CITY_ALIASES: Record<string, string[]> = {
  "san francisco": ["sf", "bay area", "san francisco"],
  "new york": ["nyc", "new york"],
  "los angeles": ["la", "los angeles"],
  "washington": ["dc", "washington"],
};

function locationPatterns(locations: string[]): string[] {
  const out = new Set<string>();
  for (const raw of locations) {
    const city = raw.split(",")[0]!.trim().toLowerCase();
    if (!city) continue;
    out.add(city);
    for (const [key, aliases] of Object.entries(CITY_ALIASES)) {
      if (aliases.includes(city) || key === city) aliases.forEach((a) => out.add(a));
    }
  }
  return [...out];
}

/** Hard constraints in SQL. These are things a student cannot work around, not tastes. */
function hardFilters(p: PrefsInput): SQL[] {
  const where: SQL[] = [
    eq(jobs.active, true),
    gte(jobFeatures.isInternship, 0.5),
    gte(jobFeatures.isLegit, 0.4),
  ];
  if (p.needsSponsorship) where.push(ne(jobFeatures.sponsorship, "excludes"));
  if (!p.usCitizen) where.push(lt(jobFeatures.citizenshipRequired, 0.6));
  if (p.paidOnly) where.push(ne(jobFeatures.paid, "unpaid"));
  if (p.seasons.length) where.push(inArray(jobFeatures.season, [...p.seasons, "unclear"]));

  const remoteOnly = p.workModes.length === 1 && p.workModes[0] === "remote";
  if (remoteOnly) {
    where.push(sql`(${jobs.remote} OR ${jobFeatures.workMode} = 'remote')`);
  } else if (p.locations.length) {
    const pats = locationPatterns(p.locations).map((c) => sql`${jobs.location} ILIKE ${"%" + c + "%"}`);
    const remoteOk = p.workModes.length === 0 || p.workModes.includes("remote");
    where.push(sql`(${sql.join(pats, sql` OR `)}${remoteOk ? sql` OR ${jobs.remote}` : sql``})`);
  }
  return where;
}

export function profileHash(p: Pick<PrefsInput, "interests" | "skills" | "classYear">): string {
  return sha(`${p.interests}\n${p.skills}\n${p.classYear}`).slice(0, 16);
}

type Candidate = {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  payText: string | null;
  description: string;
  firstSeenAt: Date;
  roleFamily: string;
  workMode: string;
  season: string;
  needsReview: boolean;
  answers: JobAnswers;
};

async function loadCandidates(p: PrefsInput, exclude: string[], blockedCompanies: string[]): Promise<Candidate[]> {
  const db = await getDb();
  const where = hardFilters(p);
  if (exclude.length) where.push(notInArray(jobs.id, exclude));
  if (blockedCompanies.length) where.push(notInArray(jobs.company, blockedCompanies));
  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
      location: jobs.location,
      url: jobs.url,
      payText: jobs.payText,
      description: jobs.description,
      firstSeenAt: jobs.firstSeenAt,
      roleFamily: jobFeatures.roleFamily,
      workMode: jobFeatures.workMode,
      season: jobFeatures.season,
      needsReview: jobFeatures.needsReview,
      answers: jobFeatures.answers,
    })
    .from(jobs)
    .innerJoin(jobFeatures, eq(jobFeatures.jobId, jobs.id))
    .where(and(...where))
    .orderBy(desc(jobs.firstSeenAt))
    .limit(2000);
  return rows as Candidate[];
}

/** Box-Muller; used to perturb weights for exploration. */
function gaussian(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export type RankOptions = {
  count: number;
  /** How many of `count` go to exploration picks. */
  exploreCount: number;
  /** How many top candidates get the personal Jev fit pass. */
  fitShortlist: number;
  /** Number of feedback updates so far; exploration narrows as the model learns. */
  updates: number;
  cachedFits?: Map<string, Fit>;
  onNewFits?: (fits: Map<string, Fit>) => Promise<void>;
};

/** Pure ranking over candidates. Used by the daily run and by the onboarding preview. */
export async function rank(
  p: PrefsInput,
  weights: Weights,
  candidates: Candidate[],
  opts: RankOptions,
): Promise<RankedJob[]> {
  const now = new Date();
  const fitMap = new Map(opts.cachedFits ?? []);
  const scoreOf = (c: Candidate, w: Weights) => {
    const x = featuresFor(c.answers, c, fitMap.get(c.id) ?? null, now);
    // Uncertain classifications still show up, just with less pull.
    return { x, z: dot(w, x) - (c.needsReview ? 0.4 : 0) };
  };

  // Stage 1: rank everything with job-level features only.
  const firstPass = candidates
    .map((c) => ({ c, z: scoreOf(c, weights).z }))
    .sort((a, b) => b.z - a.z);

  // Stage 2: Jev personal fit on the shortlist only.
  const shortlist = firstPass.slice(0, opts.fitShortlist).map((s) => s.c).filter((c) => !fitMap.has(c.id));
  if (shortlist.length) {
    const { fits: fresh } = await scoreFit(
      { interests: p.interests, skills: p.skills, year: p.classYear },
      shortlist,
    );
    for (const [k, v] of fresh) fitMap.set(k, v);
    if (fresh.size && opts.onNewFits) await opts.onNewFits(fresh);
  }

  const scored = firstPass
    .slice(0, Math.max(opts.fitShortlist, opts.count * 4))
    .map(({ c }) => ({ c, ...scoreOf(c, weights) }))
    .sort((a, b) => b.z - a.z);

  const toRanked = (s: (typeof scored)[number], exploreFlag: boolean): RankedJob => ({
    id: s.c.id,
    title: s.c.title,
    company: s.c.company,
    location: s.c.location,
    url: s.c.url,
    payText: s.c.payText,
    roleFamily: s.c.roleFamily,
    workMode: s.c.workMode,
    season: s.c.season,
    score: s.z,
    reason: exploreFlag ? "Something different, to learn what you like" : explain(weights, s.x, s.c.roleFamily),
    explore: exploreFlag,
    firstSeenAt: s.c.firstSeenAt,
  });

  // One posting per company per batch keeps the list varied.
  const seenCompany = new Set<string>();
  const exploit: RankedJob[] = [];
  for (const s of scored) {
    if (exploit.length >= opts.count - opts.exploreCount) break;
    if (seenCompany.has(s.c.company)) continue;
    seenCompany.add(s.c.company);
    exploit.push(toRanked(s, false));
  }

  // Exploration: Thompson-style. Perturb the weights with noise that shrinks as the
  // model sees more feedback, and take what rises to the top only under the noise.
  const explore: RankedJob[] = [];
  if (opts.exploreCount > 0) {
    const sigma = 0.9 / Math.sqrt(1 + opts.updates);
    const noisy: Weights = Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, v + sigma * gaussian()]));
    const taken = new Set(exploit.map((e) => e.id));
    const pool = firstPass
      .slice(0, 300)
      .map(({ c }) => ({ c, ...scoreOf(c, noisy) }))
      .sort((a, b) => b.z - a.z);
    for (const s of pool) {
      if (explore.length >= opts.exploreCount) break;
      if (taken.has(s.c.id) || seenCompany.has(s.c.company)) continue;
      seenCompany.add(s.c.company);
      explore.push(toRanked(s, true));
    }
  }

  // Interleave explore picks so they are not all at the bottom.
  const out = [...exploit];
  explore.forEach((e, i) => out.splice(Math.min(out.length, 2 + i * 4), 0, e));
  return out;
}

/** Anonymous preview during onboarding: nothing is written. */
export async function previewForPreferences(p: PrefsInput, count = 5): Promise<RankedJob[]> {
  const weights = priorFromPreferences({ ...p, hasInterests: !!p.interests.trim() });
  const candidates = await loadCandidates(p, [], []);
  return rank(p, weights, candidates, { count, exploreCount: 0, fitShortlist: 16, updates: 0 });
}

export async function loadUserModel(userId: string, p: PrefsInput) {
  const db = await getDb();
  const [m] = await db.select().from(userModels).where(eq(userModels.userId, userId));
  if (m) return m;
  const prior = priorFromPreferences({ ...p, hasInterests: !!p.interests.trim() });
  const [created] = await db
    .insert(userModels)
    .values({ userId, weights: prior, prior })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.select().from(userModels).where(eq(userModels.userId, userId)))[0]!;
}

/** Build and store the next batch of matches for a user. Returns what was added. */
export async function buildMatches(userId: string, count = 8): Promise<RankedJob[]> {
  const db = await getDb();
  const [p] = await db.select().from(preferences).where(eq(preferences.userId, userId));
  if (!p) return [];
  const model = await loadUserModel(userId, p);
  const already = await db.select({ jobId: matches.jobId }).from(matches).where(eq(matches.userId, userId));
  const candidates = await loadCandidates(p, already.map((a) => a.jobId), model.blockedCompanies);
  if (candidates.length === 0) return [];

  const hash = profileHash(p);
  const cached = await db
    .select()
    .from(fits)
    .where(and(eq(fits.userId, userId), eq(fits.profileHash, hash)));

  const ranked = await rank(p, model.weights, candidates, {
    count,
    exploreCount: count >= 6 ? 2 : 1,
    fitShortlist: 40,
    updates: model.updates,
    cachedFits: new Map(cached.map((f) => [f.jobId, { interest: f.interestFit, skills: f.skillsFit }])),
    onNewFits: async (fresh) => {
      const rows = [...fresh].map(([jobId, f]) => ({
        userId,
        jobId,
        profileHash: hash,
        interestFit: f.interest,
        skillsFit: f.skills,
      }));
      await db
        .insert(fits)
        .values(rows)
        .onConflictDoUpdate({
          target: [fits.userId, fits.jobId],
          set: {
            profileHash: sql`excluded.profile_hash`,
            interestFit: sql`excluded.interest_fit`,
            skillsFit: sql`excluded.skills_fit`,
          },
        });
    },
  });

  if (ranked.length) {
    await db
      .insert(matches)
      .values(ranked.map((r) => ({ userId, jobId: r.id, score: r.score, explore: r.explore, reason: r.reason })))
      .onConflictDoNothing();
  }
  return ranked;
}
