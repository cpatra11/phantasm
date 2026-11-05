CREATE TABLE IF NOT EXISTS "artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"brand_id" text,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"current_version" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brands" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_url" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credits" (
	"user_id" text PRIMARY KEY NOT NULL,
	"total" integer NOT NULL,
	"used" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "renders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"artifact_id" text NOT NULL,
	"version" integer NOT NULL,
	"aspect" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"remote_id" text,
	"bucket_name" text,
	"function_name" text,
	"region" text,
	"url" text,
	"error" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "versions" (
	"id" text PRIMARY KEY NOT NULL,
	"artifact_id" text NOT NULL,
	"version" integer NOT NULL,
	"doc" jsonb NOT NULL,
	"message" text NOT NULL,
	"created_at" text NOT NULL
);
