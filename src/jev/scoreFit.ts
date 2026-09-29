import { jevMode } from "@/lib/env";
import { jev, limited } from "./client";
import { offlineFit } from "./offline";
import { fitQuestions } from "./questions";

// Jev pass B: how well a posting fits one student's own words. Only run on a
// short list per user, and batched: several postings share one request, each
// referenced by key, so the student profile is sent once per batch.

const BATCH = 8;
const DESC_CHARS = 2_400;

export type FitProfile = { interests: string; skills: string; year: string };
export type FitJob = { id: string; title: string; company: string; location: string; description: string };
export type Fit = { interest: number; skills: number };

export async function scoreFit(profile: FitProfile, jobs: FitJob[]): Promise<{ fits: Map<string, Fit>; inputTokens: number }> {
  const fits = new Map<string, Fit>();
  if (jobs.length === 0 || (!profile.interests.trim() && !profile.skills.trim())) return { fits, inputTokens: 0 };

  if (jevMode() === "offline") {
    for (const j of jobs) fits.set(j.id, offlineFit(profile.interests, profile.skills, j));
    return { fits, inputTokens: 0 };
  }

  let inputTokens = 0;
  const batches: FitJob[][] = [];
  for (let i = 0; i < jobs.length; i += BATCH) batches.push(jobs.slice(i, i + BATCH));

  await Promise.all(
    batches.map(async (batch) => {
      const postings: Record<string, { title: string; company: string; location: string; description: string }> = {};
      let questions = {};
      batch.forEach((j, i) => {
        const key = `p${i}`;
        postings[key] = {
          title: j.title,
          company: j.company,
          location: j.location,
          description: j.description.slice(0, DESC_CHARS),
        };
        questions = { ...questions, ...fitQuestions(key) };
      });
      const res = await limited(() =>
        jev().systemOne({
          state: { student: { interests: profile.interests, skills: profile.skills, year: profile.year }, postings },
          questions,
        }),
      );
      inputTokens += res.usage.input_tokens;
      const answers = res.answers as Record<string, { score: number }>;
      batch.forEach((j, i) => {
        const interest = answers[`interest_p${i}`]?.score ?? 2;
        const skills = answers[`skills_p${i}`]?.score ?? 1.5;
        fits.set(j.id, { interest: interest / 4, skills: skills / 3 });
      });
    }),
  );
  return { fits, inputTokens };
}
