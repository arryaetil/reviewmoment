CREATE TYPE "public"."domain_status" AS ENUM('pending', 'verifying', 'verified', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."recipient_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'member', 'admin');--> statement-breakpoint
CREATE TABLE "send_job_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"status" "recipient_status" DEFAULT 'pending' NOT NULL,
	"resend_message_id" text,
	"error" text,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "send_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"total_recipients" integer NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"from_address" text NOT NULL,
	"review_link" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email_hash" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" text NOT NULL,
	"google_review_link" text NOT NULL,
	"subdomain" text NOT NULL,
	"sending_domain" text NOT NULL,
	"resend_domain_id" text,
	"domain_status" "domain_status" DEFAULT 'pending' NOT NULL,
	"domain_verified_at" timestamp with time zone,
	"from_name" text NOT NULL,
	"reply_to" text NOT NULL,
	"monthly_email_limit" integer DEFAULT 2000 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'owner' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "send_job_recipients" ADD CONSTRAINT "send_job_recipients_job_id_send_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."send_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "send_jobs" ADD CONSTRAINT "send_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "send_jobs" ADD CONSTRAINT "send_jobs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppressions" ADD CONSTRAINT "suppressions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "send_job_recipients_job_idx" ON "send_job_recipients" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "send_job_recipients_job_email_idx" ON "send_job_recipients" USING btree ("job_id","email");--> statement-breakpoint
CREATE INDEX "send_job_recipients_status_idx" ON "send_job_recipients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "send_jobs_tenant_idx" ON "send_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "send_jobs_status_idx" ON "send_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "send_jobs_created_at_idx" ON "send_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "suppressions_tenant_hash_idx" ON "suppressions" USING btree ("tenant_id","email_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_subdomain_idx" ON "tenants" USING btree ("subdomain");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_sending_domain_idx" ON "tenants" USING btree ("sending_domain");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");