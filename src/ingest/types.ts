import { z } from "zod";

/** What every source adapter must produce. Validated before anything touches the DB. */
export const NormalizedJob = z.object({
  source: z.string(),
  sourceId: z.string(),
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().default(""),
  remote: z.boolean().default(false),
  url: z.url(),
  /** Plain text, HTML already stripped. */
  description: z.string().default(""),
  payText: z.string().nullish(),
  postedAt: z.date().nullish(),
  /** True when the whole source only lists internships (e.g. the Simplify list). */
  internOnlySource: z.boolean().default(false),
});
export type NormalizedJob = z.infer<typeof NormalizedJob>;

export interface Source {
  id: string;
  fetch(signal?: AbortSignal): AsyncIterable<NormalizedJob>;
}
