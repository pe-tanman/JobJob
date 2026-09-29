import { env } from "./env";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Open in dev when no secret is set. */
export function cronAuthorized(req: Request): boolean {
  if (!env.cronSecret) return !env.isProd;
  return req.headers.get("authorization") === `Bearer ${env.cronSecret}`;
}
