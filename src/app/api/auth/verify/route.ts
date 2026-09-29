import { eq, isNull, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { startSession } from "@/lib/session";
import { readToken } from "@/lib/tokens";

export async function GET(req: Request) {
  const token = readToken(new URL(req.url).searchParams.get("t") ?? undefined, "login");
  if (!token) redirect("/signin?expired=1");

  const db = await getDb();
  await db
    .update(schema.users)
    .set({ verifiedAt: new Date() })
    .where(and(eq(schema.users.id, token.u), isNull(schema.users.verifiedAt)));
  await startSession(token.u);
  redirect("/matches?welcome=1");
}
