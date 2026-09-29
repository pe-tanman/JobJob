import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, schema } from "@/db/client";
import { env } from "./env";
import { DAY_MS, makeToken, readToken } from "./tokens";

const COOKIE = "jj_session";
const SESSION_DAYS = 60;

export async function startSession(userId: string) {
  const store = await cookies();
  store.set(COOKIE, makeToken({ k: "session", u: userId, exp: Date.now() + SESSION_DAYS * DAY_MS }), {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser() {
  const token = readToken((await cookies()).get(COOKIE)?.value, "session");
  if (!token) return null;
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, token.u));
  return user ?? null;
}
