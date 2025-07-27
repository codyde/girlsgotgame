-- Create reports table for content moderation
CREATE TABLE "reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reported_by" varchar(255) NOT NULL,
  "report_type" varchar(20) NOT NULL,
  "reported_item_id" uuid NOT NULL,
  "reason" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "admin_notes" text,
  "resolved_by" varchar(255),
  "resolved_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX "reports_reported_by_idx" ON "reports" ("reported_by");
CREATE INDEX "reports_status_idx" ON "reports" ("status");
CREATE INDEX "reports_report_type_idx" ON "reports" ("report_type");
CREATE INDEX "reports_created_at_idx" ON "reports" ("created_at" DESC);