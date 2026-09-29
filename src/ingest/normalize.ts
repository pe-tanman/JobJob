import { createHash } from "node:crypto";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/** Greenhouse double-encodes HTML, so decode entities before stripping tags. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  const decoded = html.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m);
  return decoded
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>|<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function canon(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(inc|llc|ltd|corp|corporation|co)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Same posting from two sources (e.g. Greenhouse and the Simplify list) gets one id. */
export function jobKey(company: string, title: string, location: string): string {
  const firstLocation = location.split(/[;|]/)[0] ?? "";
  return sha(`${canon(company)}|${canon(title)}|${canon(firstLocation)}`).slice(0, 24);
}

export function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

const REMOTE = /\b(remote|anywhere|distributed|work from home|wfh)\b/i;
export function looksRemote(...parts: (string | null | undefined)[]): boolean {
  return parts.some((p) => !!p && REMOTE.test(p));
}

/** Title signals that a posting is for students. Used only to save Jev calls. */
const STUDENT_TITLE =
  /\b(intern|interns|internship|co-?op|coop|student|apprentice|fellow(ship)?|summer analyst|summer associate|trainee|werkstudent|new grad|university|campus|graduate program|early career|externship)\b/i;
const SENIOR_TITLE = /\b(senior|sr\.?|staff|principal|lead|director|manager|head of|vp|chief)\b/i;

/**
 * Cheap gate before Jev. Anything plausibly an internship goes through;
 * the model makes the real call. Intern-only sources always pass.
 */
export function passesPrefilter(title: string, internOnlySource: boolean): boolean {
  if (internOnlySource) return true;
  if (!STUDENT_TITLE.test(title)) return false;
  // "Senior Manager, Intern Programs" is not an internship.
  if (SENIOR_TITLE.test(title) && !/\b(intern|co-?op)\b/i.test(title.split(/[,(-]/)[0] ?? "")) {
    return false;
  }
  return true;
}

/** "jane-street" -> "Jane Street". Only a fallback when no display name is known. */
export function prettySlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

/** Tidy titles for display: collapse whitespace and use plain hyphens for dash separators. */
export function cleanTitle(title: string): string {
  return title.replace(/\s*[\u2012-\u2015]\s*/g, " - ").replace(/\s+/g, " ").trim();
}
