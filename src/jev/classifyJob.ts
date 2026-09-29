import { jevMode } from "@/lib/env";
import { jev, limited } from "./client";
import { offlineClassify } from "./offline";
import { jobQuestions, type JobAnswers } from "./questions";

/** Roughly 3k tokens of description is plenty to judge these questions and keeps each call cheap. */
const MAX_DESCRIPTION_CHARS = 12_000;

export type JobState = {
  posting: {
    title: string;
    company: string;
    location: string;
    pay: string | null;
    source: string;
    description: string;
  };
};

export function jobState(job: {
  title: string;
  company: string;
  location: string;
  payText: string | null;
  source: string;
  description: string;
}): JobState {
  return {
    posting: {
      title: job.title,
      company: job.company,
      location: job.location,
      pay: job.payText,
      source: job.source,
      description: job.description.slice(0, MAX_DESCRIPTION_CHARS),
    },
  };
}

export type Classification = {
  model: string;
  answers: JobAnswers;
  inputTokens: number;
};

export async function classifyJob(state: JobState): Promise<Classification> {
  if (jevMode() === "offline") {
    return { model: "offline-dev", answers: offlineClassify(state), inputTokens: 0 };
  }
  const res = await limited(() => jev().systemOne({ state, questions: jobQuestions }));
  return { model: res.model, answers: res.answers, inputTokens: res.usage.input_tokens };
}

/**
 * Flatten typed answers into the scalar columns used for SQL prefiltering.
 * Thresholds here are starting points; `npm run eval:jev` is where they get tuned.
 */
export function toFeatureRow(jobId: string, contentHash: string, c: Classification) {
  const a = c.answers;
  const uncertainInternship = a.is_internship.noul > 0.35 && a.is_internship.noul < 0.65;
  const uncertainRole = a.role_family.confidence < 0.35;
  return {
    jobId,
    contentHash,
    model: c.model,
    isInternship: a.is_internship.noul,
    isLegit: a.is_legit.noul,
    roleFamily: a.role_family.choice,
    season: a.season.choice,
    workMode: a.work_mode.choice,
    paid: a.paid.choice,
    sponsorship: a.sponsorship.choice,
    citizenshipRequired: a.citizenship_required.noul,
    classYear: a.class_year.choice,
    needsReview: uncertainInternship || uncertainRole,
    answers: a,
    inputTokens: c.inputTokens,
  };
}
