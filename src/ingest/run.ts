import { and, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import pLimit from "p-limit";
import { getDb, schema } from "@/db/client";
import type { IngestStats } from "@/db/schema";
import { classifyJob, jobState, toFeatureRow } from "@/jev/classifyJob";
import { USD_PER_INPUT_TOKEN } from "@/jev/client";
import { jevMode } from "@/lib/env";
import { SEED_BOARDS } from "./companies";
import { cleanTitle, jobKey, sha } from "./normalize";
import { ashby } from "./sources/ashby";
import { greenhouse } from "./sources/greenhouse";
import { lever } from "./sources/lever";
import { simplify, type AtsSlug } from "./sources/simplify";
import { NormalizedJob, type Source } from "./types";

const { jobs, jobFeatures, ingestRuns } = schema;

export type IngestOptions = {
  /** Fetch and report, but write nothing and call no model. */
  dry?: boolean;
  /** Cap on Jev calls this run. Protects the budget if a source suddenly floods. */
  maxClassify?: number;
  /** Cap on ATS boards fetched (useful for quick local runs). */
  maxBoards?: number;
  log?: (msg: string) => void;
};

/** Jobs not seen for this long are marked inactive. Tolerates a source being down for a run. */
const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

function boardSource(b: AtsSlug): Source {
  if (b.ats === "greenhouse") return greenhouse(b.slug);
  if (b.ats === "lever") return lever(b.slug, b.company);
  return ashby(b.slug, b.company);
}

type Row = typeof jobs.$inferInsert & { contentHash: string };

function toRow(raw: NormalizedJob, now: Date): Row {
  const j = { ...raw, title: cleanTitle(raw.title) };
  return {
    id: jobKey(j.company, j.title, j.location),
    source: j.source,
    sourceId: j.sourceId,
    company: j.company,
    title: j.title,
    location: j.location,
    remote: j.remote,
    url: j.url,
    description: j.description,
    payText: j.payText ?? null,
    postedAt: j.postedAt ?? null,
    firstSeenAt: now,
    lastSeenAt: now,
    active: true,
    contentHash: sha(`${j.title}\n${j.location}\n${j.payText ?? ""}\n${j.description}`),
  };
}

export async function runIngest(opts: IngestOptions = {}): Promise<IngestStats> {
  const log = opts.log ?? (() => {});
  const now = new Date();
  const stats: IngestStats = {
    perSource: {},
    newJobs: 0,
    changedJobs: 0,
    classified: 0,
    jevInputTokens: 0,
    deactivated: 0,
  };
  const byId = new Map<string, Row>();

  const collect = async (source: Source) => {
    const s = (stats.perSource[source.id.split(":")[0]!] ??= { fetched: 0, kept: 0, errors: 0 });
    try {
      for await (const raw of source.fetch()) {
        s.fetched++;
        const parsed = NormalizedJob.safeParse(raw);
        // Adapters already applied the student prefilter with source-specific signals.
        if (!parsed.success) continue;
        const row = toRow(parsed.data, now);
        const prev = byId.get(row.id);
        // Same posting from two sources: keep the one with the richer description.
        if (!prev || row.description!.length > prev.description!.length) byId.set(row.id, row);
        s.kept++;
      }
    } catch (err) {
      s.errors++;
      log(`source ${source.id} failed: ${(err as Error).message}`);
    }
  };

  // 1. Simplify first: it is intern-only and tells us which ATS boards to visit.
  const boards = new Map<string, AtsSlug>(SEED_BOARDS.map((b) => [`${b.ats}:${b.slug}`, b]));
  await collect(simplify((b) => boards.set(`${b.ats}:${b.slug}`, { ...boards.get(`${b.ats}:${b.slug}`), ...b })));
  log(`simplify: ${stats.perSource.simplify?.kept ?? 0} listings, ${boards.size} ATS boards known`);

  // 2. Direct ATS boards, politely concurrent.
  const boardList = [...boards.values()].slice(0, opts.maxBoards ?? Infinity);
  const limit = pLimit(8);
  let done = 0;
  await Promise.all(
    boardList.map((b) =>
      limit(async () => {
        await collect(boardSource(b));
        if (++done % 50 === 0) log(`boards: ${done}/${boardList.length}`);
      }),
    ),
  );
  log(`collected ${byId.size} unique postings`);

  if (opts.dry) return stats;

  const db = await getDb();
  const rows = [...byId.values()];

  // 3. Upsert in chunks. On conflict the incoming copy wins when it comes from the same
  // source (a real edit, even if shorter) or carries a richer description.
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const existing = await db
      .select({ id: jobs.id, contentHash: jobs.contentHash, source: jobs.source, len: sql<number>`length(${jobs.description})` })
      .from(jobs)
      .where(inArray(jobs.id, chunk.map((r) => r.id)));
    const known = new Map(existing.map((e) => [e.id, e]));
    for (const r of chunk) {
      const k = known.get(r.id);
      if (!k) stats.newJobs++;
      else if (k.contentHash !== r.contentHash && (k.source === r.source || r.description!.length > Number(k.len))) stats.changedJobs++;
    }
    const richer = sql`(excluded.source = ${jobs.source} OR length(excluded.description) > length(${jobs.description}))`;
    await db
      .insert(jobs)
      .values(chunk)
      .onConflictDoUpdate({
        target: jobs.id,
        set: {
          title: sql`excluded.title`,
          lastSeenAt: now,
          active: true,
          description: sql`CASE WHEN ${richer} THEN excluded.description ELSE ${jobs.description} END`,
          contentHash: sql`CASE WHEN ${richer} THEN excluded.content_hash ELSE ${jobs.contentHash} END`,
          url: sql`CASE WHEN ${richer} THEN excluded.url ELSE ${jobs.url} END`,
          source: sql`CASE WHEN ${richer} THEN excluded.source ELSE ${jobs.source} END`,
          payText: sql`COALESCE(excluded.pay_text, ${jobs.payText})`,
        },
      });
  }

  const deactivated = await db
    .update(jobs)
    .set({ active: false })
    .where(and(eq(jobs.active, true), lt(jobs.lastSeenAt, new Date(now.getTime() - STALE_AFTER_MS))))
    .returning({ id: jobs.id });
  stats.deactivated = deactivated.length;

  // 4. Jev pass A on new or changed postings only.
  const todo = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
      location: jobs.location,
      payText: jobs.payText,
      source: jobs.source,
      description: jobs.description,
      contentHash: jobs.contentHash,
    })
    .from(jobs)
    .leftJoin(jobFeatures, eq(jobFeatures.jobId, jobs.id))
    .where(
      and(
        eq(jobs.active, true),
        or(
          isNull(jobFeatures.jobId),
          ne(jobFeatures.contentHash, jobs.contentHash),
          // Results from the dev stand-in are replaced once a real key is configured.
          jevMode() === "live" ? eq(jobFeatures.model, "offline-dev") : undefined,
        ),
      ),
    )
    .limit(opts.maxClassify ?? 5000);

  log(`classifying ${todo.length} postings with Jev`);
  await Promise.all(
    todo.map(async (j) => {
      try {
        const c = await classifyJob(jobState(j));
        const row = toFeatureRow(j.id, j.contentHash, c);
        await db
          .insert(jobFeatures)
          .values(row)
          .onConflictDoUpdate({ target: jobFeatures.jobId, set: { ...row, classifiedAt: new Date() } });
        stats.classified++;
        stats.jevInputTokens += c.inputTokens;
        if (stats.classified % 250 === 0) log(`classified ${stats.classified}/${todo.length}`);
      } catch (err) {
        log(`classify ${j.id} failed: ${(err as Error).message}`);
      }
    }),
  );

  await db.insert(ingestRuns).values({ startedAt: now, finishedAt: new Date(), stats });
  log(
    `done: ${stats.newJobs} new, ${stats.changedJobs} changed, ${stats.classified} classified, ` +
      `${stats.jevInputTokens} Jev tokens (~$${(stats.jevInputTokens * USD_PER_INPUT_TOKEN).toFixed(4)})`,
  );
  return stats;
}
