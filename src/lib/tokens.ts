import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

// Compact signed tokens: base64url(JSON payload) + "." + HMAC. Used for the session
// cookie, magic links, and one-click feedback links in emails (which must work
// without logging in, so they are scoped to exactly one user, job and action).

type Payload =
  | { k: "session"; u: string; exp: number }
  | { k: "login"; u: string; exp: number }
  | { k: "fb"; u: string; j: string; s: "interested" | "dismissed"; exp: number }
  | { k: "unsub"; u: string; exp: number };

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");

function sign(body: string): string {
  return createHmac("sha256", env.secret).update(body).digest("base64url");
}

export function makeToken(p: Payload): string {
  const body = b64(JSON.stringify(p));
  return `${body}.${sign(body)}`;
}

export function readToken<K extends Payload["k"]>(token: string | undefined, kind: K): Extract<Payload, { k: K }> | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (p.k !== kind || p.exp < Date.now()) return null;
    return p as Extract<Payload, { k: K }>;
  } catch {
    return null;
  }
}

export const DAY_MS = 24 * 60 * 60 * 1000;
