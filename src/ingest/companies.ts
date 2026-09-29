import type { AtsSlug } from "./sources/simplify";

// Seed boards. The list grows every run from ATS links found in the Simplify
// listings, so this only needs companies that list interns but may be missing there.
export const SEED_BOARDS: AtsSlug[] = [
  ...[
    "stripe",
    "airbnb",
    "databricks",
    "figma",
    "robinhood",
    "discord",
    "cloudflare",
    "datadog",
    "reddit",
    "pinterest",
    "lyft",
    "dropbox",
    "gitlab",
    "coinbase",
    "instacart",
    "duolingo",
    "asana",
    "affirm",
    "roblox",
    "twitch",
    "scaleai",
    "anduril",
    "spacex",
    "waymo",
  ].map((slug) => ({ ats: "greenhouse" as const, slug })),
  ...["palantir", "plaid", "spotify", "zoox", "shieldai"].map((slug) => ({ ats: "lever" as const, slug })),
  ...["ramp", "notion", "linear", "openai", "vercel", "replit", "cursor"].map((slug) => ({
    ats: "ashby" as const,
    slug,
  })),
];
