import { getJson } from "../http";
import { htmlToText, looksRemote, passesPrefilter } from "../normalize";
import type { NormalizedJob, Source } from "../types";

type GhJob = {
  id: number;
  title: string;
  absolute_url: string;
  company_name?: string;
  location?: { name?: string };
  first_published?: string;
  updated_at?: string;
  content?: string;
};

/** Public board API, no key: boards-api.greenhouse.io/v1/boards/{slug}/jobs */
export function greenhouse(slug: string): Source {
  return {
    id: `greenhouse:${slug}`,
    async *fetch(signal) {
      const data = await getJson<{ jobs: GhJob[] }>(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`,
        { signal },
      );
      for (const j of data?.jobs ?? []) {
        // Filter before converting HTML: most of a big board is full-time roles.
        if (!passesPrefilter(j.title, false)) continue;
        const location = j.location?.name ?? "";
        const description = htmlToText(j.content);
        yield {
          source: "greenhouse",
          sourceId: `${slug}:${j.id}`,
          company: j.company_name || slug,
          title: j.title.trim(),
          location,
          remote: looksRemote(location, j.title),
          url: j.absolute_url,
          description,
          payText: null,
          postedAt: j.first_published ? new Date(j.first_published) : null,
          internOnlySource: false,
        } satisfies NormalizedJob;
      }
    },
  };
}
