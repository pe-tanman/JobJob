import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { env } from "@/lib/env";
import { DAY_MS, makeToken } from "@/lib/tokens";
import { buildMatches } from "@/rank/match";
import { DigestEmail } from "./Digest";
import { sendEmail } from "./send";

const { users, emailLog, matches } = schema;

const MIN_GAP_MS = { daily: 0.8 * DAY_MS, twice_weekly: 3 * DAY_MS, weekly: 6.5 * DAY_MS } as const;

export async function runDigests(log: (m: string) => void = () => {}) {
  const db = await getDb();
  const active = await db
    .select()
    .from(users)
    .where(and(isNotNull(users.verifiedAt), eq(users.paused, false)));

  let sent = 0;
  for (const user of active) {
    const [last] = await db
      .select({ sentAt: emailLog.sentAt })
      .from(emailLog)
      .where(and(eq(emailLog.userId, user.id), eq(emailLog.kind, "digest")))
      .orderBy(desc(emailLog.sentAt))
      .limit(1);
    if (last && Date.now() - last.sentAt.getTime() < MIN_GAP_MS[user.cadence]) continue;

    try {
      const fresh = await buildMatches(user.id, 8);
      // Nothing new means no email. Quiet is part of the product.
      if (fresh.length === 0) continue;

      const exp = Date.now() + 30 * DAY_MS;
      const link = (s: "interested" | "dismissed", jobId: string) =>
        `${env.appUrl}/f/${makeToken({ k: "fb", u: user.id, j: jobId, s, exp })}`;
      const unsubscribeUrl = `${env.appUrl}/api/unsubscribe?t=${makeToken({ k: "unsub", u: user.id, exp: Date.now() + 365 * DAY_MS })}`;

      const { id } = await sendEmail({
        to: user.email,
        subject: `${fresh.length} new internship${fresh.length === 1 ? "" : "s"}: ${fresh[0]!.company} and more`,
        unsubscribeUrl,
        react: DigestEmail({
          items: fresh.map((m) => ({
            title: m.title,
            company: m.company,
            location: m.location,
            reason: m.reason,
            applyUrl: m.url,
            interestedUrl: link("interested", m.id),
            notForMeUrl: link("dismissed", m.id),
          })),
          matchesUrl: `${env.appUrl}/matches`,
          settingsUrl: `${env.appUrl}/settings`,
          unsubscribeUrl,
        }),
      });
      const now = new Date();
      await db
        .update(matches)
        .set({ sentAt: now })
        .where(and(eq(matches.userId, user.id), inArray(matches.jobId, fresh.map((f) => f.id))));
      await db.insert(emailLog).values({ userId: user.id, kind: "digest", providerId: id, matchCount: fresh.length });
      sent++;
    } catch (err) {
      log(`digest for ${user.id} failed: ${(err as Error).message}`);
    }
  }
  log(`sent ${sent} digests to ${active.length} active users`);
  return { sent, activeUsers: active.length };
}
