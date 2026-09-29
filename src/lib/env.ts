// Central place for configuration. Everything optional has a local-dev fallback
// so the app runs end to end with zero accounts; production requires the real thing.

const isProd = process.env.NODE_ENV === "production";

function required(name: string, devFallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (!isProd && devFallback !== undefined) return devFallback;
  throw new Error(`Missing required environment variable ${name}`);
}

export const env = {
  isProd,
  // Getters so a missing production variable fails the request that needs it,
  // not `next build` (which evaluates modules while collecting routes).
  get appUrl() {
    return required("APP_URL", "http://localhost:3000");
  },
  /** HMAC secret for sessions, magic links and one-click email feedback. */
  get secret() {
    return required("JETJOB_SECRET", "dev-only-secret-change-me");
  },
  /** Postgres URL. Unset in dev means an embedded PGlite database in ./.data. */
  databaseUrl: process.env.DATABASE_URL?.trim() || undefined,
  typesafeApiKey: process.env.TYPESAFE_API_KEY?.trim() || undefined,
  resendApiKey: process.env.RESEND_API_KEY?.trim() || undefined,
  emailFrom: process.env.EMAIL_FROM?.trim() || "JetJob <hello@jetjob.dev>",
  /** Shared secret Vercel Cron sends as a bearer token. */
  cronSecret: process.env.CRON_SECRET?.trim() || undefined,
  usajobsApiKey: process.env.USAJOBS_API_KEY?.trim() || undefined,
  usajobsEmail: process.env.USAJOBS_EMAIL?.trim() || undefined,
};

/** Jev runs for real whenever a key is present. The offline stand-in is dev-only. */
export function jevMode(): "live" | "offline" {
  if (env.typesafeApiKey) return "live";
  if (isProd) throw new Error("TYPESAFE_API_KEY is required in production");
  return "offline";
}
