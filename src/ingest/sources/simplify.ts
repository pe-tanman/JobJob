import { getJson } from "../http";
import { looksRemote } from "../normalize";
import type { NormalizedJob, Source } from "../types";

type Listing = {
  id: string;
  company_name: string;
  title: string;
  url: string;
  locations: string[];
  terms?: string[];
  active: boolean;
  is_visible: boolean;
  date_posted: number;
  sponsorship?: string;
  degrees?: string[];
  category?: string;
};

// Community-maintained, internship-only list (MIT). Listings have no description,
// so the state Jev sees is built from the structured fields.
const LISTINGS_URL =
  "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json";

export type AtsSlug = { ats: "greenhouse" | "lever" | "ashby"; slug: string; company?: string };

/** Harvest ATS board slugs from listing URLs so the direct sources grow on their own. */
export function atsSlugFromUrl(raw: string): AtsSlug | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const first = u.pathname.split("/").filter(Boolean)[0];
  if (!first) return null;
  if (/(^|\.)greenhouse\.io$/.test(u.hostname) && first !== "embed") return { ats: "greenhouse", slug: first };
  if (u.hostname === "jobs.lever.co") return { ats: "lever", slug: first };
  if (u.hostname === "jobs.ashbyhq.com") return { ats: "ashby", slug: first };
  return null;
}

export function simplify(onSlug?: (s: AtsSlug) => void): Source {
  return {
    id: "simplify",
    async *fetch(signal) {
      const data = await getJson<Listing[]>(LISTINGS_URL, { signal, timeoutMs: 60_000 });
      for (const l of data ?? []) {
        if (!l.active || !l.is_visible) continue;
        const slug = atsSlugFromUrl(l.url);
        if (slug) onSlug?.({ ...slug, company: l.company_name });
        const location = l.locations.join("; ");
        const facts = [
          l.category && `Category: ${l.category}`,
          l.terms?.length && `Terms: ${l.terms.join(", ")}`,
          l.sponsorship && `Sponsorship note from listing: ${l.sponsorship}`,
          l.degrees?.length && `Degrees: ${l.degrees.join(", ")}`,
        ].filter(Boolean);
        yield {
          source: "simplify",
          sourceId: l.id,
          company: l.company_name,
          title: l.title.trim(),
          location,
          remote: looksRemote(location),
          url: l.url,
          description: facts.join("\n"),
          payText: null,
          postedAt: new Date(l.date_posted * 1000),
          internOnlySource: true,
        } satisfies NormalizedJob;
      }
    },
  };
}
