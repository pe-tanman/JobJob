import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { readToken } from "@/lib/tokens";

async function pause(req: Request): Promise<boolean> {
  const token = readToken(new URL(req.url).searchParams.get("t") ?? undefined, "unsub");
  if (!token) return false;
  const db = await getDb();
  await db.update(schema.users).set({ paused: true }).where(eq(schema.users.id, token.u));
  return true;
}

/** RFC 8058 one-click unsubscribe: mail clients POST here with no user interaction. */
export async function POST(req: Request) {
  return new Response(null, { status: (await pause(req)) ? 200 : 400 });
}

/** The link in the email footer. */
export async function GET(req: Request) {
  const ok = await pause(req);
  redirect(ok ? "/unsubscribed" : "/signin");
}
