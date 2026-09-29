import { getJson } from "../http";
import { looksRemote, passesPrefilter, prettySlug } from "../normalize";
import type { NormalizedJob, Source } from "../types";

type AshbyJob = {
  id: string;
  title: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  isRemote?: boolean;
  workplaceType?: string;
  employmentType?: string;
  jobUrl: string;
  publishedAt?: string;
  isListed?: boolean;
  descriptionPlain?: string;
  compensation?: { scrapeableCompensationSalarySummary?: string; compensationTierSummary?: string };
};

/** Public job board API, no key: api.ashbyhq.com/posting-api/job-board/{slug} */
export function ashby(slug: string, companyName?: string): Source {
  return {
    id: `ashby:${slug}`,
    async *fetch(signal) {
      const data = await getJson<{ jobs: AshbyJob[] }>(
        `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`,
        { signal },
      );
      for (const j of data?.jobs ?? []) {
        if (j.isListed === false) continue;
        const internType = j.employmentType === "Intern";
        if (!passesPrefilter(j.title, false) && !internType) continue;
        const location = [j.location, ...(j.secondaryLocations ?? []).map((l) => l.location)]
          .filter(Boolean)
          .join("; ");
        yield {
          source: "ashby",
          sourceId: `${slug}:${j.id}`,
          company: companyName ?? prettySlug(slug),
          title: j.title.trim(),
          location,
          remote: !!j.isRemote || j.workplaceType === "Remote" || looksRemote(location),
          url: j.jobUrl,
          description: [j.employmentType && `Employment type: ${j.employmentType}`, j.descriptionPlain]
            .filter(Boolean)
            .join("\n\n"),
          payText:
            j.compensation?.scrapeableCompensationSalarySummary ||
            j.compensation?.compensationTierSummary ||
            null,
          postedAt: j.publishedAt ? new Date(j.publishedAt) : null,
          internOnlySource: false,
        } satisfies NormalizedJob;
      }
    },
  };
}
