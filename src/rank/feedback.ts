import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import type { JobAnswers } from "@/jev/questions";
import { featuresFor } from "./features";
import { applyReason, update, type DismissReason, type Signal } from "./model";
import { loadUserModel } from "./match";

const { feedback, matches, jobs, jobFeatures, fits, preferences, userModels } = schema;

export type FeedbackInput = {
  userId: string;
  jobId: string;
  signal: Signal;
  channel: "web" | "email" | "onboarding";
  reason?: DismissReason;
};

/**
 * Record a signal and take one learning step. Idempotent per (user, job, signal):
 * clicking the same email link twice does not double-count.
 */
export async function recordFeedback(input: FeedbackInput): Promise<{ learned: boolean }> {
  const db = await getDb();
  const { userId, jobId, signal } = input;

  const [p] = await db.select().from(preferences).where(eq(preferences.userId, userId));
  if (!p) return { learned: false };

  const prior = await db
    .select({ signal: feedback.signal, reason: feedback.reason })
    .from(feedback)
    .where(and(eq(feedback.userId, userId), eq(feedback.jobId, jobId)));
  const repeatSignal = prior.some((f) => f.signal === signal);
  const newReason = input.reason && !prior.some((f) => f.reason === input.reason);
  if (repeatSignal && !newReason) return { learned: false };

  await db.insert(feedback).values({ ...input, reason: input.reason ?? null });
  await db
    .update(matches)
    .set({ status: signal })
    .where(and(eq(matches.userId, userId), eq(matches.jobId, jobId)));

  const [row] = await db
    .select({ answers: jobFeatures.answers, firstSeenAt: jobs.firstSeenAt, payText: jobs.payText, company: jobs.company })
    .from(jobs)
    .innerJoin(jobFeatures, eq(jobFeatures.jobId, jobs.id))
    .where(eq(jobs.id, jobId));
  if (!row) return { learned: false };

  const [fit] = await db.select().from(fits).where(and(eq(fits.userId, userId), eq(fits.jobId, jobId)));
  const x = featuresFor(row.answers as JobAnswers, row, fit ? { interest: fit.interestFit, skills: fit.skillsFit } : null);

  const model = await loadUserModel(userId, p);
  let weights = repeatSignal ? model.weights : update(model.weights, model.prior, x, signal);
  if (input.reason) weights = applyReason(weights, x, input.reason);
  const blocked =
    input.reason === "company" && !model.blockedCompanies.includes(row.company)
      ? [...model.blockedCompanies, row.company]
      : model.blockedCompanies;

  await db
    .update(userModels)
    .set({ weights, blockedCompanies: blocked, updates: model.updates + 1, updatedAt: new Date() })
    .where(eq(userModels.userId, userId));
  return { learned: true };
}
