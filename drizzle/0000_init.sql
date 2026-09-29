CREATE TABLE "email_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"kind" text NOT NULL,
	"provider_id" text,
	"match_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" text NOT NULL,
	"signal" text NOT NULL,
	"reason" text,
	"channel" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fits" (
	"user_id" uuid NOT NULL,
	"job_id" text NOT NULL,
	"profile_hash" text NOT NULL,
	"interest_fit" real NOT NULL,
	"skills_fit" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fits_user_id_job_id_pk" PRIMARY KEY("user_id","job_id")
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"stats" jsonb
);
--> statement-breakpoint
CREATE TABLE "job_features" (
	"job_id" text PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"content_hash" text NOT NULL,
	"is_internship" real NOT NULL,
	"is_legit" real NOT NULL,
	"role_family" text NOT NULL,
	"season" text NOT NULL,
	"work_mode" text NOT NULL,
	"paid" text NOT NULL,
	"sponsorship" text NOT NULL,
	"citizenship_required" real NOT NULL,
	"class_year" text NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"answers" jsonb NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"classified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"remote" boolean DEFAULT false NOT NULL,
	"url" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"pay_text" text,
	"posted_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"content_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" text NOT NULL,
	"score" real NOT NULL,
	"explore" boolean DEFAULT false NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"roles" text[] DEFAULT '{}'::text[] NOT NULL,
	"seasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"work_modes" text[] DEFAULT '{}'::text[] NOT NULL,
	"locations" text[] DEFAULT '{}'::text[] NOT NULL,
	"needs_sponsorship" boolean DEFAULT false NOT NULL,
	"us_citizen" boolean DEFAULT false NOT NULL,
	"class_year" text DEFAULT 'any' NOT NULL,
	"paid_only" boolean DEFAULT true NOT NULL,
	"interests" text DEFAULT '' NOT NULL,
	"skills" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_models" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"weights" jsonb NOT NULL,
	"prior" jsonb NOT NULL,
	"blocked_companies" text[] DEFAULT '{}'::text[] NOT NULL,
	"updates" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"verified_at" timestamp with time zone,
	"cadence" text DEFAULT 'daily' NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"timezone" text DEFAULT 'America/Chicago' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fits" ADD CONSTRAINT "fits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fits" ADD CONSTRAINT "fits_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_features" ADD CONSTRAINT "job_features_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_models" ADD CONSTRAINT "user_models_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_active_seen_idx" ON "jobs" USING btree ("active","first_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_user_job_idx" ON "matches" USING btree ("user_id","job_id");