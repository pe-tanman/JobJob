import { and, count, desc, eq, gte, ilike, inArray, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { ROLE_FAMILIES, SEASONS, WORK_MODES } from "@/jev/questions";

const { jobs, jobFeatures, matches } = schema;

export const PAGE_SIZE = 30;

export type BrowseFilters = {
  q: string;
  roles: string[];
  season: string;
  mode: string;
  location: string;
  paidOnly: boolean;
  sponsorship: boolean;
  noCitizenship: boolean;
  sort: "newest" | "company";
  page: number;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

/** URL search params are untrusted: keep only known values. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): BrowseFilters {
  const page = Number.parseInt(one(sp.page), 10);
  return {
    q: one(sp.q).trim().slice(0, 80),
    roles: many(sp.role).filter((r) => r in ROLE_FAMILIES),
    season: one(sp.season) in SEASONS ? one(sp.season) : "",
    mode: one(sp.mode) in WORK_MODES ? one(sp.mode) : "",
    location: one(sp.loc).trim().slice(0, 60),
    paidOnly: one(sp.paid) === "1",
    sponsorship: one(sp.sponsor) === "1",
    noCitizenship: one(sp.nocitizen) === "1",
    sort: one(sp.sort) === "company" ? "company" : "newest",
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1,
  };
}

/** Everything except the role filter, so role counts show what each choice would give. */
function baseWhere(f: BrowseFilters): SQL[] {
  const w: SQL[] = [eq(jobs.active, true), gte(jobFeatures.isInternship, 0.5), gte(jobFeatures.isLegit, 0.4)];
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    w.push(or(ilike(jobs.title, like), ilike(jobs.company, like))!);
  }
  if (f.season) w.push(eq(jobFeatures.season, f.season));
  if (f.mode === "remote") w.push(sql`(${jobs.remote} OR ${jobFeatures.workMode} = 'remote')`);
  else if (f.mode) w.push(eq(jobFeatures.workMode, f.mode));
  if (f.location) w.push(ilike(jobs.location, `%${f.location.replace(/[%_\\]/g, (c) => `\\${c}`)}%`));
  if (f.paidOnly) w.push(ne(jobFeatures.paid, "unpaid"));
  if (f.sponsorship) w.push(ne(jobFeatures.sponsorship, "excludes"));
  if (f.noCitizenship) w.push(lt(jobFeatures.citizenshipRequired, 0.6));
  return w;
}

export type BrowseRow = {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  payText: string | null;
  postedAt: Date | null;
  firstSeenAt: Date;
  roleFamily: string;
  season: string;
  workMode: string;
  paid: string;
  sponsorship: string;
  citizenshipRequired: number;
  needsReview: boolean;
};

export async function browse(f: BrowseFilters, userId?: string) {
  const db = await getDb();
  const base = baseWhere(f);
  const where = f.roles.length ? [...base, inArray(jobFeatures.roleFamily, f.roles)] : base;

  const [rows, [{ total }], roleCounts, saved] = await Promise.all([
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        location: jobs.location,
        remote: jobs.remote,
        url: jobs.url,
        payText: jobs.payText,
        postedAt: jobs.postedAt,
        firstSeenAt: jobs.firstSeenAt,
        roleFamily: jobFeatures.roleFamily,
        season: jobFeatures.season,
        workMode: jobFeatures.workMode,
        paid: jobFeatures.paid,
        sponsorship: jobFeatures.sponsorship,
        citizenshipRequired: jobFeatures.citizenshipRequired,
        needsReview: jobFeatures.needsReview,
      })
      .from(jobs)
      .innerJoin(jobFeatures, eq(jobFeatures.jobId, jobs.id))
      .where(and(...where))
      .orderBy(
        ...(f.sort === "company"
          ? [jobs.company, jobs.title]
          : [desc(sql`coalesce(${jobs.postedAt}, ${jobs.firstSeenAt})`), jobs.id]),
      )
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(jobs)
      .innerJoin(jobFeatures, eq(jobFeatures.jobId, jobs.id))
      .where(and(...where)),
    db
      .select({ role: jobFeatures.roleFamily, n: count() })
      .from(jobs)
      .innerJoin(jobFeatures, eq(jobFeatures.jobId, jobs.id))
      .where(and(...base))
      .groupBy(jobFeatures.roleFamily),
    userId
      ? db
          .select({ jobId: matches.jobId, status: matches.status })
          .from(matches)
          .where(eq(matches.userId, userId))
      : Promise.resolve([]),
  ]);

  return {
    rows: rows as BrowseRow[],
    total: Number(total),
    pages: Math.max(1, Math.ceil(Number(total) / PAGE_SIZE)),
    roleCounts: new Map(roleCounts.map((r) => [r.role, Number(r.n)])),
    saved: new Map(saved.map((s) => [s.jobId, s.status])),
  };
}
