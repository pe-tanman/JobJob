import { getJson } from "../http";
import { looksRemote, passesPrefilter, prettySlug } from "../normalize";
import type { NormalizedJob, Source } from "../types";

type LeverJob = {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  workplaceType?: string;
  categories?: { location?: string; commitment?: string; allLocations?: string[] };
  descriptionPlain?: string;
  additionalPlain?: string;
  lists?: { text: string; content: string }[];
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
};

function pay(r: LeverJob["salaryRange"]): string | null {
  if (!r || (r.min == null && r.max == null)) return null;
  const cur = r.currency ?? "USD";
  const interval = r.interval ? ` ${r.interval.replace(/-/g, " ")}` : "";
  return `${cur} ${r.min ?? "?"}-${r.max ?? "?"}${interval}`;
}

/** Public postings API, no key: api.lever.co/v0/postings/{slug}?mode=json */
export function lever(slug: string, companyName?: string): Source {
  return {
    id: `lever:${slug}`,
    async *fetch(signal) {
      const data = await getJson<LeverJob[]>(
        `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`,
        { signal },
      );
      for (const j of data ?? []) {
        const commitment = j.categories?.commitment ?? "";
        const internCommitment = /intern|co-?op|student/i.test(commitment);
        if (!passesPrefilter(j.text, false) && !internCommitment) continue;
        const location = j.categories?.allLocations?.join("; ") || j.categories?.location || "";
        const lists = (j.lists ?? [])
          .map((l) => `${l.text}\n${l.content.replace(/<[^>]+>/g, " ")}`)
          .join("\n\n");
        yield {
          source: "lever",
          sourceId: `${slug}:${j.id}`,
          company: companyName ?? prettySlug(slug),
          title: j.text.trim(),
          location,
          remote: j.workplaceType === "remote" || looksRemote(location),
          url: j.hostedUrl,
          description: [commitment && `Commitment: ${commitment}`, j.descriptionPlain, lists, j.additionalPlain]
            .filter(Boolean)
            .join("\n\n"),
          payText: pay(j.salaryRange),
          postedAt: j.createdAt ? new Date(j.createdAt) : null,
          internOnlySource: false,
        } satisfies NormalizedJob;
      }
    },
  };
}
