import { and, desc, eq, ne } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { SiteHeader } from "@/components/SiteHeader";
import { currentUser } from "@/lib/session";
import { buildMatches } from "@/rank/match";
import { Feed, type FeedItem } from "./Feed";

export const metadata: Metadata = { title: "Your matches" };

const { matches, jobs } = schema;

async function loadFeed(userId: string): Promise<FeedItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
      location: jobs.location,
      url: jobs.url,
      payText: jobs.payText,
      active: jobs.active,
      reason: matches.reason,
      explore: matches.explore,
      status: matches.status,
      createdAt: matches.createdAt,
    })
    .from(matches)
    .innerJoin(jobs, eq(jobs.id, matches.jobId))
    .where(and(eq(matches.userId, userId), ne(matches.status, "dismissed")))
    .orderBy(desc(matches.createdAt), desc(matches.score))
    .limit(60);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const { welcome } = await searchParams;

  let items = await loadFeed(user.id);
  // First visit after confirming: build the first batch right away instead of waiting for tomorrow's email.
  if (items.length === 0) {
    await buildMatches(user.id, 8);
    items = await loadFeed(user.id);
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="sky-wash flex-1">
        <div className="mx-auto grid w-full max-w-3xl gap-8 px-4 pt-10 pb-20 md:pt-14">
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {welcome ? "You are all set" : "Your matches"}
            </h1>
            <p className="max-w-[60ch] text-ink-muted">
              {welcome
                ? "Here is your first batch. Your email arrives when something new fits, never more than you asked for."
                : "Mark what interests you. Each answer changes what we send next."}
            </p>
          </div>
          <Feed initial={items} />
        </div>
      </main>
    </>
  );
}
