import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  cadence: text("cadence", { enum: ["daily", "twice_weekly", "weekly"] })
    .notNull()
    .default("daily"),
  paused: boolean("paused").notNull().default(false),
  timezone: text("timezone").notNull().default("America/Chicago"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const preferences = pgTable("preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  roles: text("roles").array().notNull().default(sql`'{}'::text[]`),
  seasons: text("seasons").array().notNull().default(sql`'{}'::text[]`),
  workModes: text("work_modes").array().notNull().default(sql`'{}'::text[]`),
  locations: text("locations").array().notNull().default(sql`'{}'::text[]`),
  needsSponsorship: boolean("needs_sponsorship").notNull().default(false),
  usCitizen: boolean("us_citizen").notNull().default(false),
  classYear: text("class_year").notNull().default("any"),
  paidOnly: boolean("paid_only").notNull().default(true),
  interests: text("interests").notNull().default(""),
  skills: text("skills").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable(
  "jobs",
  {
    /** Stable dedupe key: hash of normalized company + title + location. */
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    company: text("company").notNull(),
    title: text("title").notNull(),
    location: text("location").notNull().default(""),
    remote: boolean("remote").notNull().default(false),
    url: text("url").notNull(),
    description: text("description").notNull().default(""),
    payText: text("pay_text"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    active: boolean("active").notNull().default(true),
    /** Hash of the text Jev sees; a change triggers reclassification. */
    contentHash: text("content_hash").notNull(),
  },
  (t) => [index("jobs_active_seen_idx").on(t.active, t.firstSeenAt)],
);

/**
 * Jev pass A output. One row per job, shared by every user.
 * Scalar columns support SQL prefiltering; `answers` keeps the full typed
 * answers with probabilities so ranking can change without re-running inference.
 */
export const jobFeatures = pgTable("job_features", {
  jobId: text("job_id")
    .primaryKey()
    .references(() => jobs.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  contentHash: text("content_hash").notNull(),
  isInternship: real("is_internship").notNull(),
  isLegit: real("is_legit").notNull(),
  roleFamily: text("role_family").notNull(),
  season: text("season").notNull(),
  workMode: text("work_mode").notNull(),
  paid: text("paid").notNull(),
  sponsorship: text("sponsorship").notNull(),
  citizenshipRequired: real("citizenship_required").notNull(),
  classYear: text("class_year").notNull(),
  needsReview: boolean("needs_review").notNull().default(false),
  answers: jsonb("answers").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  classifiedAt: timestamp("classified_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Jev pass B output: personal fit, only computed for a user's shortlisted candidates. */
export const fits = pgTable(
  "fits",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    /** Hash of the user's interests + skills text, so edits invalidate old fits. */
    profileHash: text("profile_hash").notNull(),
    interestFit: real("interest_fit").notNull(),
    skillsFit: real("skills_fit").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.jobId] })],
);

export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    explore: boolean("explore").notNull().default(false),
    /** Short "why this" line built in code from the top weighted features. */
    reason: text("reason").notNull(),
    status: text("status", { enum: ["new", "interested", "dismissed", "applied"] })
      .notNull()
      .default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("matches_user_job_idx").on(t.userId, t.jobId)],
);

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  signal: text("signal", { enum: ["interested", "dismissed", "applied"] }).notNull(),
  reason: text("reason"),
  channel: text("channel", { enum: ["web", "email", "onboarding"] }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userModels = pgTable("user_models", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  weights: jsonb("weights").$type<Record<string, number>>().notNull(),
  prior: jsonb("prior").$type<Record<string, number>>().notNull(),
  blockedCompanies: text("blocked_companies").array().notNull().default(sql`'{}'::text[]`),
  updates: integer("updates").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailLog = pgTable("email_log", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  kind: text("kind", { enum: ["magic_link", "digest"] }).notNull(),
  providerId: text("provider_id"),
  matchCount: integer("match_count").notNull().default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ingestRuns = pgTable("ingest_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  stats: jsonb("stats").$type<IngestStats>(),
});

export type IngestStats = {
  perSource: Record<string, { fetched: number; kept: number; errors: number }>;
  newJobs: number;
  changedJobs: number;
  classified: number;
  jevInputTokens: number;
  deactivated: number;
};

export type Job = typeof jobs.$inferSelect;
export type JobFeatures = typeof jobFeatures.$inferSelect;
export type Preferences = typeof preferences.$inferSelect;
export type User = typeof users.$inferSelect;
