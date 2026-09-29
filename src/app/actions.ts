"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db/client";
import { MagicLinkEmail } from "@/email/MagicLink";
import { sendEmail } from "@/email/send";
import { env } from "@/lib/env";
import { PrefsSchema, type Prefs } from "@/lib/prefs";
import { currentUser, endSession } from "@/lib/session";
import { makeToken, readToken } from "@/lib/tokens";
import { recordFeedback } from "@/rank/feedback";
import { buildMatches, previewForPreferences } from "@/rank/match";
import { priorFromPreferences } from "@/rank/model";

const { users, preferences, userModels, emailLog } = schema;

export type PreviewJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  reason: string;
};

/** Onboarding preview: real matches from the current pool, nothing stored. */
export async function previewAction(raw: Prefs): Promise<{ jobs: PreviewJob[] } | { error: string }> {
  const parsed = PrefsSchema.safeParse(raw);
  if (!parsed.success) return { error: "Some answers look off. Go back and check them." };
  try {
    const ranked = await previewForPreferences(parsed.data, 5);
    return {
      jobs: ranked.map((r) => ({
        id: r.id,
        title: r.title,
        company: r.company,
        location: r.location,
        url: r.url,
        reason: r.reason,
      })),
    };
  } catch (err) {
    console.error("[preview]", err);
    return { error: "We could not load examples right now. You can still finish signing up." };
  }
}

async function sendLoginLink(userId: string, email: string): Promise<string> {
  const url = `${env.appUrl}/api/auth/verify?t=${makeToken({ k: "login", u: userId, exp: Date.now() + 30 * 60 * 1000 })}`;
  const { id } = await sendEmail({ to: email, subject: "Confirm your JetJob email", react: MagicLinkEmail({ url }) });
  const db = await getDb();
  await db.insert(emailLog).values({ userId, kind: "magic_link", providerId: id });
  return url;
}

const SignupSchema = z.object({
  email: z.email().max(254),
  prefs: PrefsSchema,
  previewFeedback: z
    .array(z.object({ jobId: z.string().max(64), signal: z.enum(["interested", "dismissed"]) }))
    .max(10),
});

export type SignupResult = { ok: true; devLink?: string } | { ok: false; error: string };

export async function signupAction(raw: z.input<typeof SignupSchema>): Promise<SignupResult> {
  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.some((i) => i.path[0] === "email");
    return { ok: false, error: emailIssue ? "Enter a valid email address, like you@school.edu." : "Something in your answers is invalid." };
  }
  const { email, prefs, previewFeedback } = parsed.data;
  const db = await getDb();
  const normalized = email.trim().toLowerCase();

  const [existing] = await db.select().from(users).where(eq(users.email, normalized));
  // A verified account keeps its preferences: typing someone's email must not change them.
  if (existing?.verifiedAt) {
    const link = await sendLoginLink(existing.id, normalized);
    return { ok: true, devLink: env.isProd ? undefined : link };
  }

  const user =
    existing ??
    (await db.insert(users).values({ email: normalized }).returning())[0]!;

  const prefRow = { ...prefs, userId: user.id, updatedAt: new Date() };
  await db.insert(preferences).values(prefRow).onConflictDoUpdate({ target: preferences.userId, set: prefRow });
  const prior = priorFromPreferences({ ...prefs, hasInterests: !!prefs.interests });
  await db
    .insert(userModels)
    .values({ userId: user.id, weights: prior, prior })
    .onConflictDoUpdate({ target: userModels.userId, set: { weights: prior, prior, updates: 0 } });

  // The preview answers are the model's first lesson.
  for (const f of previewFeedback) {
    await recordFeedback({ userId: user.id, jobId: f.jobId, signal: f.signal, channel: "onboarding" }).catch(() => {});
  }

  const link = await sendLoginLink(user.id, normalized);
  return { ok: true, devLink: env.isProd ? undefined : link };
}

export async function signinAction(raw: { email: string }): Promise<SignupResult> {
  const parsed = z.object({ email: z.email() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address, like you@school.edu." };
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email.trim().toLowerCase()));
  // Same response either way, so the form does not reveal who has an account.
  if (!user) return { ok: true };
  const link = await sendLoginLink(user.id, user.email);
  return { ok: true, devLink: env.isProd ? undefined : link };
}

const FeedbackSchema = z.object({
  jobId: z.string().max(64),
  signal: z.enum(["interested", "dismissed", "applied"]),
  reason: z.enum(["location", "role", "company", "too_senior", "timing"]).optional(),
});

export async function feedbackAction(raw: z.input<typeof FeedbackSchema>) {
  const user = await currentUser();
  if (!user) return { ok: false as const, error: "Your session ended. Sign in again." };
  const parsed = FeedbackSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "That did not work. Try again." };
  await recordFeedback({ userId: user.id, channel: "web", ...parsed.data });
  return { ok: true as const };
}

/** Landing page for the one-click links in digest emails. */
export async function emailFeedbackAction(token: string, reason?: z.infer<typeof FeedbackSchema>["reason"]) {
  const t = readToken(token, "fb");
  if (!t) return { ok: false as const };
  await recordFeedback({ userId: t.u, jobId: t.j, signal: t.s, channel: "email", reason });
  return { ok: true as const };
}

export async function refreshMatchesAction() {
  const user = await currentUser();
  if (!user) return { added: 0 };
  const added = await buildMatches(user.id, 8);
  return { added: added.length };
}

export async function savePreferencesAction(raw: Prefs) {
  const user = await currentUser();
  if (!user) return { ok: false as const, error: "Your session ended. Sign in again." };
  const parsed = PrefsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Some answers look off." };
  const db = await getDb();
  await db
    .update(preferences)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(preferences.userId, user.id));
  // Stated preferences move the prior; what the model learned from clicks is kept.
  const [m] = await db.select().from(userModels).where(eq(userModels.userId, user.id));
  const prior = priorFromPreferences({ ...parsed.data, hasInterests: !!parsed.data.interests });
  if (m) {
    const weights = { ...m.weights };
    for (const k of Object.keys(prior)) weights[k] = (weights[k] ?? 0) + (prior[k]! - (m.prior[k] ?? 0));
    await db.update(userModels).set({ weights, prior }).where(eq(userModels.userId, user.id));
  }
  return { ok: true as const };
}

const SettingsSchema = z.object({
  cadence: z.enum(["daily", "twice_weekly", "weekly"]),
  paused: z.boolean(),
});

export async function saveSettingsAction(raw: z.input<typeof SettingsSchema>) {
  const user = await currentUser();
  if (!user) return { ok: false as const, error: "Your session ended. Sign in again." };
  const parsed = SettingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Pick one of the options." };
  const db = await getDb();
  await db.update(users).set(parsed.data).where(eq(users.id, user.id));
  return { ok: true as const };
}

export async function signOutAction() {
  await endSession();
  redirect("/");
}

export async function deleteAccountAction() {
  const user = await currentUser();
  if (!user) redirect("/");
  const db = await getDb();
  // Cascades remove preferences, matches, feedback, fits and the learned model.
  await db.delete(users).where(eq(users.id, user.id));
  await endSession();
  redirect("/?deleted=1");
}

/**
 * Save or hide a posting found on the Browse page. Creates the match row so saved
 * postings appear on /matches, then records the signal so the model learns from it.
 */
export async function browseSignalAction(raw: { jobId: string; signal: "interested" | "dismissed" }) {
  const user = await currentUser();
  if (!user) return { ok: false as const, error: "Sign in to save postings." };
  const parsed = z
    .object({ jobId: z.string().max(64), signal: z.enum(["interested", "dismissed"]) })
    .safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "That did not work. Try again." };
  const db = await getDb();
  await db
    .insert(schema.matches)
    .values({ userId: user.id, jobId: parsed.data.jobId, score: 0, reason: "You found this in Browse", status: "new" })
    .onConflictDoNothing();
  await recordFeedback({ userId: user.id, jobId: parsed.data.jobId, signal: parsed.data.signal, channel: "web" });
  return { ok: true as const };
}
