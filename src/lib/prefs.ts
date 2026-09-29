import { z } from "zod";
import { CLASS_YEARS, ROLE_FAMILIES, SEASONS, WORK_MODES } from "@/jev/questions";

const roleKeys = Object.keys(ROLE_FAMILIES) as [string, ...string[]];
const seasonKeys = Object.keys(SEASONS).filter((s) => s !== "unclear") as [string, ...string[]];
const modeKeys = Object.keys(WORK_MODES).filter((m) => m !== "unclear") as [string, ...string[]];
const yearKeys = Object.keys(CLASS_YEARS) as [string, ...string[]];

/** Everything onboarding collects. Validated on the server; the client is never trusted. */
export const PrefsSchema = z.object({
  roles: z.array(z.enum(roleKeys)).max(17),
  seasons: z.array(z.enum(seasonKeys)).max(4),
  workModes: z.array(z.enum(modeKeys)).max(3),
  locations: z.array(z.string().trim().min(1).max(60)).max(12),
  needsSponsorship: z.boolean(),
  usCitizen: z.boolean(),
  classYear: z.enum(yearKeys),
  paidOnly: z.boolean(),
  interests: z.string().trim().max(1500),
  skills: z.string().trim().max(1500),
});
export type Prefs = z.infer<typeof PrefsSchema>;

export const EMPTY_PREFS: Prefs = {
  roles: [],
  seasons: [],
  workModes: [],
  locations: [],
  needsSponsorship: false,
  usCitizen: false,
  classYear: "any",
  paidOnly: true,
  interests: "",
  skills: "",
};
