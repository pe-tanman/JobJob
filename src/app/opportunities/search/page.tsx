import { CaretLeft, CaretRight, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { currentUser } from "@/lib/session";
import { browse, PAGE_SIZE, parseFilters } from "@/rank/browse";
import { searchWhere } from "@/rank/search";
import { Row } from "../Row";

// Experiment: reachable only by URL, so keep it out of search engines.
export const metadata: Metadata = {
  title: "Search internships",
  description: "Search every internship JetJob has found with one box.",
  robots: { index: false },
};

const EXAMPLES = ["remote ml summer", "quant new york", "software austin", "design paid"];

function hrefFor(q: string, page: number): string {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `/opportunities/search?${s}` : "/opportunities/search";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // Only q and page count here; every other filter stays at its default.
  const f = parseFilters({ q: undefined, page: sp.page });
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 120) ?? "";
  const { where, readings } = searchWhere(q);
  const user = await currentUser();
  const { rows, total, pages, saved } = await browse(f, user?.id, where);
  const nf = new Intl.NumberFormat("en-US");
  const from = total === 0 ? 0 : (f.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, f.page * PAGE_SIZE);

  return (
    <>
      <SiteHeader />
      <main id="main" className="sky-wash flex-1">
        <div className="mx-auto grid max-w-3xl gap-8 px-4 pt-10 pb-20 md:px-8 md:pt-14">
          <search className="grid gap-3">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Search internships</h1>
            <form method="get" action="/opportunities/search" className="flex gap-2">
              <label htmlFor="q" className="sr-only">
                Search by title, company, place, kind of work or season
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={q}
                autoFocus={!q}
                autoComplete="off"
                enterKeyHint="search"
                placeholder="Try “remote ml summer” or “quant new york”"
                aria-describedby="q-help"
                className="input min-h-14 flex-1 text-lg"
              />
              <button type="submit" className="btn-primary min-h-14 px-6">
                <MagnifyingGlass size={20} aria-hidden />
                <span className="sr-only sm:not-sr-only">Search</span>
              </button>
            </form>
            <p id="q-help" className="text-sm text-ink-muted">
              Every word has to match. Use quotes for a phrase, like &quot;new york&quot;.
            </p>
            {readings.length > 0 && (
              <ul className="flex flex-wrap gap-1.5 text-sm text-ink-muted" aria-label="How your search was read">
                {readings.map((r) => (
                  <li key={r.term} className="rounded-full border border-current/15 px-2.5 py-1">
                    <span className="font-medium text-ink">{r.term}</span> {r.filter ? "only shows" : "also matches"} {r.as.join(", ")}
                  </li>
                ))}
              </ul>
            )}
          </search>

          <section aria-labelledby="results-heading" className="grid gap-4">
            <h2 id="results-heading" className="text-lg font-semibold">
              {total === 0 ? "No internships match" : `${nf.format(total)} internship${total === 1 ? "" : "s"}`}
              {total > 0 && pages > 1 && (
                <span className="font-normal text-ink-muted">
                  , showing {nf.format(from)} to {nf.format(to)}
                </span>
              )}
            </h2>

            {total === 0 ? (
              <div className="card grid justify-items-start gap-3 p-8">
                <p className="text-lg font-semibold">Nothing matches every word.</p>
                <p className="max-w-[55ch] text-ink-muted">Try fewer words, or one of these:</p>
                <ul className="flex flex-wrap gap-2">
                  {EXAMPLES.map((e) => (
                    <li key={e}>
                      <Link href={hrefFor(e, 1)} className="btn-quiet">
                        {e}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ul className="grid gap-3">
                {rows.map((r) => (
                  <Row key={r.id} r={r} signedIn={!!user} saved={saved.get(r.id)} />
                ))}
              </ul>
            )}

            {pages > 1 && (
              <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 pt-4">
                {f.page > 1 ? (
                  <Link href={hrefFor(q, f.page - 1)} className="btn-quiet" rel="prev">
                    <CaretLeft size={18} aria-hidden /> Previous
                  </Link>
                ) : (
                  <span />
                )}
                <p className="text-ink-muted">
                  Page {f.page} of {nf.format(pages)}
                </p>
                {f.page < pages ? (
                  <Link href={hrefFor(q, f.page + 1)} className="btn-quiet" rel="next">
                    Next <CaretRight size={18} aria-hidden />
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
