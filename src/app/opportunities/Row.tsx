import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import type { BrowseRow } from "@/rank/browse";
import { roleLabel } from "@/rank/features";
import { RowActions } from "./RowActions";

export const SEASON_LABEL: Record<string, string> = {
  summer: "Summer",
  fall: "Fall term",
  winter_spring: "Winter or spring",
  year_round: "During the school year",
};
export const MODE_LABEL: Record<string, string> = { onsite: "In person", hybrid: "Hybrid", remote: "Remote" };

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function posted(d: Date): string {
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (days > -1) return "Posted today";
  if (days > -30) return `Posted ${rtf.format(days, "day")}`;
  return `Posted ${rtf.format(Math.round(days / 30), "month")}`;
}

function Tag({ children }: { children: React.ReactNode }) {
  return <li className="rounded-full bg-sky-2 px-2.5 py-1 text-[13px] leading-none font-medium text-ink-muted">{children}</li>;
}

export function Row({ r, signedIn, saved }: { r: BrowseRow; signedIn: boolean; saved?: string }) {
  const headingId = `op-${r.id}`;
  return (
    <li className="card grid gap-3 p-5" aria-labelledby={headingId}>
      <div className="grid gap-1">
        <h3 id={headingId} className="text-[17px] leading-snug font-semibold text-balance">
          <a href={r.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
            {r.title}
            <ArrowSquareOut size={15} className="ml-1 inline align-[-2px] text-ink-muted" aria-hidden />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </h3>
        <p className="text-ink-muted">
          {r.company}
          {r.location ? `, ${r.location}` : r.remote ? ", Remote" : ""}
        </p>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Details">
        <Tag>{roleLabel(r.roleFamily)}</Tag>
        {SEASON_LABEL[r.season] && <Tag>{SEASON_LABEL[r.season]}</Tag>}
        {MODE_LABEL[r.workMode] && <Tag>{MODE_LABEL[r.workMode]}</Tag>}
        {r.paid === "paid" && <Tag>{r.payText ?? "Paid"}</Tag>}
        {r.paid === "unpaid" && <Tag>Unpaid</Tag>}
        {r.sponsorship === "offers" && <Tag>Sponsors visas</Tag>}
        {r.sponsorship === "excludes" && <Tag>No visa sponsorship</Tag>}
        {r.citizenshipRequired >= 0.6 && <Tag>US citizens only</Tag>}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">{posted(r.postedAt ?? r.firstSeenAt)}</p>
        {signedIn && (
          <RowActions
            jobId={r.id}
            title={r.title}
            initial={saved === "interested" || saved === "applied" ? "interested" : saved === "dismissed" ? "dismissed" : "none"}
          />
        )}
      </div>
    </li>
  );
}
