import { CaretLeft, CaretRight, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { currentUser } from "@/lib/session";
import { browse, PAGE_SIZE, parseFilters, type BrowseFilters } from "@/rank/browse";
import { roleLabel } from "@/rank/features";
import { FilterDisclosure } from "./FilterDisclosure";
import { MODE_LABEL, Row, SEASON_LABEL } from "./Row";

export const metadata: Metadata = {
  title: "Browse internships",
  description: "Every internship JetJob has found, sorted by kind of work, timing and location.",
};

const ROLE_ORDER = [
  "software_engineering",
  "machine_learning_ai",
  "data_science_analytics",
  "hardware_electrical",
  "mechanical_aerospace_civil",
  "quant_trading",
  "product_management",
  "infrastructure_security",
  "research_science",
  "design_ux",
  "finance_accounting",
  "consulting_strategy",
  "marketing_content",
  "sales_business_development",
  "operations_supply_chain",
  "people_legal_policy",
  "other",
];

/** Build a URL for these filters with some values changed. */
function hrefFor(f: BrowseFilters, patch: Partial<BrowseFilters>): string {
  const n = { ...f, ...patch };
  const p = new URLSearchParams();
  if (n.q) p.set("q", n.q);
  for (const r of n.roles) p.append("role", r);
  if (n.season) p.set("season", n.season);
  if (n.mode) p.set("mode", n.mode);
  if (n.location) p.set("loc", n.location);
  if (n.paidOnly) p.set("paid", "1");
  if (n.sponsorship) p.set("sponsor", "1");
  if (n.noCitizenship) p.set("nocitizen", "1");
  if (n.sort !== "newest") p.set("sort", n.sort);
  if (n.page > 1) p.set("page", String(n.page));
  const s = p.toString();
  return s ? `/opportunities?${s}` : "/opportunities";
}

function activeCount(f: BrowseFilters): number {
  return (
    f.roles.length +
    [f.q, f.season, f.mode, f.location].filter(Boolean).length +
    [f.paidOnly, f.sponsorship, f.noCitizenship].filter(Boolean).length
  );
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const f = parseFilters(await searchParams);
  const user = await currentUser();
  const { rows, total, pages, roleCounts, saved } = await browse(f, user?.id);
  const roles = ROLE_ORDER.filter((r) => (roleCounts.get(r) ?? 0) > 0 || f.roles.includes(r));
  const nf = new Intl.NumberFormat("en-US");
  const from = total === 0 ? 0 : (f.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, f.page * PAGE_SIZE);

  return (
    <>
      <SiteHeader />
      <main id="main" className="sky-wash flex-1">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-10 pb-20 md:px-8 md:pt-14">
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Browse internships</h1>
            <p className="max-w-[62ch] text-ink-muted">
              Every open internship JetJob has found, checked by Jev so full-time roles and spam stay out.
              {!user && (
                <>
                  {" "}
                  <Link href="/onboarding" className="font-medium text-accent-ink underline underline-offset-4">
                    Get started
                  </Link>{" "}
                  to have the best ones emailed to you.
                </>
              )}
            </p>
          </div>

          <div className="grid items-start gap-8 md:grid-cols-[260px_1fr] lg:grid-cols-[280px_1fr]">
            <aside aria-label="Filters" className="md:sticky md:top-20 md:max-h-[calc(100dvh-6rem)] md:overflow-y-auto md:pr-2">
              <FilterDisclosure activeCount={activeCount(f)}>
                <form method="get" action="/opportunities" className="grid gap-6 pt-2">
                  <div className="grid gap-2">
                    <label htmlFor="q" className="field-label">
                      Title or company
                    </label>
                    <input id="q" name="q" type="search" defaultValue={f.q} className="input" />
                  </div>

                  <fieldset className="grid gap-2">
                    <legend className="field-label mb-2">Kind of work</legend>
                    {roles.map((r) => (
                      <label key={r} className="flex min-h-9 cursor-pointer items-center gap-3 text-[15px]">
                        <input
                          type="checkbox"
                          name="role"
                          value={r}
                          defaultChecked={f.roles.includes(r)}
                          className="size-5 shrink-0 accent-[var(--accent)]"
                        />
                        <span className="flex-1">{roleLabel(r)}</span>
                        <span className="font-mono text-sm text-ink-muted">{nf.format(roleCounts.get(r) ?? 0)}</span>
                      </label>
                    ))}
                  </fieldset>

                  <div className="grid gap-2">
                    <label htmlFor="season" className="field-label">
                      When
                    </label>
                    <select id="season" name="season" defaultValue={f.season} className="input">
                      <option value="">Any time</option>
                      {Object.entries(SEASON_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor="mode" className="field-label">
                      Work style
                    </label>
                    <select id="mode" name="mode" defaultValue={f.mode} className="input">
                      <option value="">Any</option>
                      {Object.entries(MODE_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor="loc" className="field-label">
                      Location
                    </label>
                    <p id="loc-help" className="field-help">
                      A city or state, like Austin or TX.
                    </p>
                    <input id="loc" name="loc" defaultValue={f.location} aria-describedby="loc-help" className="input" />
                  </div>

                  <fieldset className="grid gap-2">
                    <legend className="field-label mb-2">Only show</legend>
                    {(
                      [
                        ["paid", f.paidOnly, "Paid or pay not stated"],
                        ["sponsor", f.sponsorship, "Open to visa sponsorship"],
                        ["nocitizen", f.noCitizenship, "No citizenship requirement"],
                      ] as const
                    ).map(([name, on, label]) => (
                      <label key={name} className="flex min-h-9 cursor-pointer items-center gap-3 text-[15px]">
                        <input type="checkbox" name={name} value="1" defaultChecked={on} className="size-5 shrink-0 accent-[var(--accent)]" />
                        {label}
                      </label>
                    ))}
                  </fieldset>

                  <div className="grid gap-2">
                    <label htmlFor="sort" className="field-label">
                      Sort by
                    </label>
                    <select id="sort" name="sort" defaultValue={f.sort} className="input">
                      <option value="newest">Newest first</option>
                      <option value="company">Company, A to Z</option>
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className="btn-primary">
                      <MagnifyingGlass size={18} aria-hidden />
                      Apply filters
                    </button>
                    {activeCount(f) > 0 && (
                      <Link href="/opportunities" className="btn-ghost">
                        Clear all
                      </Link>
                    )}
                  </div>
                </form>
              </FilterDisclosure>
            </aside>

            <section aria-labelledby="results-heading" className="grid gap-4">
              <h2 id="results-heading" className="text-lg font-semibold">
                {total === 0
                  ? "No internships match"
                  : `${nf.format(total)} internship${total === 1 ? "" : "s"}`}
                {total > 0 && pages > 1 && (
                  <span className="font-normal text-ink-muted">
                    , showing {nf.format(from)} to {nf.format(to)}
                  </span>
                )}
              </h2>

              {total === 0 ? (
                <div className="card grid justify-items-start gap-3 p-8">
                  <p className="text-lg font-semibold">Nothing matches every filter.</p>
                  <p className="max-w-[55ch] text-ink-muted">
                    Try removing a filter or two. New postings arrive every 6 hours.
                  </p>
                  <Link href="/opportunities" className="btn-quiet">
                    Clear all filters
                  </Link>
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
                    <Link href={hrefFor(f, { page: f.page - 1 })} className="btn-quiet" rel="prev">
                      <CaretLeft size={18} aria-hidden /> Previous
                    </Link>
                  ) : (
                    <span />
                  )}
                  <p className="text-ink-muted">
                    Page {f.page} of {nf.format(pages)}
                  </p>
                  {f.page < pages ? (
                    <Link href={hrefFor(f, { page: f.page + 1 })} className="btn-quiet" rel="next">
                      Next <CaretRight size={18} aria-hidden />
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
