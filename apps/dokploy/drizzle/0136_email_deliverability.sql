-- Email Deliverability & Production Readiness Migration
-- Phase 1: Critical Foundations

-- ==================== Bounce Handling ====================
CREATE TABLE IF NOT EXISTS "email_bounces" (
	"bounceId" text PRIMARY KEY NOT NULL,
	"emailDomainId" text NOT NULL,
	"emailAccountId" text,
	"recipientEmail" text NOT NULL,
	"bounceType" text NOT NULL, -- 'hard', 'soft', 'transient'
	"bounceCode" text,
	"bounceMessage" text,
	"bouncedAt" text NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "email_bounces_emailDomainId_fkey" FOREIGN KEY ("emailDomainId") REFERENCES "email_domains"("emailDomainId") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "email_bounces_emailDomainId_idx" ON "email_bounces"("emailDomainId");
CREATE INDEX IF NOT EXISTS "email_bounces_recipientEmail_idx" ON "email_bounces"("recipientEmail");
CREATE INDEX IF NOT EXISTS "email_bounces_bouncedAt_idx" ON "email_bounces"("bouncedAt");

-- ==================== Complaint Handling ====================
CREATE TABLE IF NOT EXISTS "email_complaints" (
	"complaintId" text PRIMARY KEY NOT NULL,
	"emailDomainId" text NOT NULL,
	"recipientEmail" text NOT NULL,
	"complaintSource" text, -- 'feedback-loop', 'abuse-report', 'manual'
	"complaintDate" text NOT NULL,
	"messageId" text,
	"complaintDetails" jsonb,
	CONSTRAINT "email_complaints_emailDomainId_fkey" FOREIGN KEY ("emailDomainId") REFERENCES "email_domains"("emailDomainId") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "email_complaints_emailDomainId_idx" ON "email_complaints"("emailDomainId");
CREATE INDEX IF NOT EXISTS "email_complaints_recipientEmail_idx" ON "email_complaints"("recipientEmail");
CREATE INDEX IF NOT EXISTS "email_complaints_complaintDate_idx" ON "email_complaints"("complaintDate");

-- ==================== Suppression List ====================
CREATE TABLE IF NOT EXISTS "email_suppressions" (
	"suppressionId" text PRIMARY KEY NOT NULL,
	"emailDomainId" text NOT NULL,
	"emailAddress" text NOT NULL,
	"suppressionType" text NOT NULL, -- 'bounce', 'complaint', 'unsubscribe', 'manual'
	"suppressedAt" text NOT NULL,
	"reason" text,
	CONSTRAINT "email_suppressions_emailDomainId_fkey" FOREIGN KEY ("emailDomainId") REFERENCES "email_domains"("emailDomainId") ON DELETE CASCADE,
	CONSTRAINT "email_suppressions_emailDomainId_emailAddress_unique" UNIQUE("emailDomainId", "emailAddress")
);

CREATE INDEX IF NOT EXISTS "email_suppressions_emailDomainId_idx" ON "email_suppressions"("emailDomainId");
CREATE INDEX IF NOT EXISTS "email_suppressions_emailAddress_idx" ON "email_suppressions"("emailAddress");
CREATE INDEX IF NOT EXISTS "email_suppressions_suppressionType_idx" ON "email_suppressions"("suppressionType");

-- ==================== Rate Limiting ====================
CREATE TABLE IF NOT EXISTS "email_rate_limits" (
	"rateLimitId" text PRIMARY KEY NOT NULL,
	"emailDomainId" text NOT NULL,
	"emailAccountId" text,
	"limitType" text NOT NULL, -- 'daily', 'hourly', 'per_minute'
	"limitValue" integer NOT NULL,
	"currentCount" integer DEFAULT 0 NOT NULL,
	"resetAt" text NOT NULL,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL,
	CONSTRAINT "email_rate_limits_emailDomainId_fkey" FOREIGN KEY ("emailDomainId") REFERENCES "email_domains"("emailDomainId") ON DELETE CASCADE,
	CONSTRAINT "email_rate_limits_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "email_accounts"("emailAccountId") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "email_rate_limits_emailDomainId_idx" ON "email_rate_limits"("emailDomainId");
CREATE INDEX IF NOT EXISTS "email_rate_limits_emailAccountId_idx" ON "email_rate_limits"("emailAccountId");
CREATE INDEX IF NOT EXISTS "email_rate_limits_resetAt_idx" ON "email_rate_limits"("resetAt");

-- ==================== Reputation Metrics ====================
CREATE TABLE IF NOT EXISTS "email_reputation_metrics" (
	"metricId" text PRIMARY KEY NOT NULL,
	"emailDomainId" text NOT NULL,
	"metricDate" text NOT NULL, -- YYYY-MM-DD format
	"totalSent" integer DEFAULT 0 NOT NULL,
	"totalDelivered" integer DEFAULT 0 NOT NULL,
	"totalBounced" integer DEFAULT 0 NOT NULL,
	"totalComplained" integer DEFAULT 0 NOT NULL,
	"bounceRate" numeric(5,4) DEFAULT 0 NOT NULL,
	"complaintRate" numeric(5,4) DEFAULT 0 NOT NULL,
	"deliveryRate" numeric(5,4) DEFAULT 0 NOT NULL,
	"senderScore" integer,
	"blacklistStatus" jsonb,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL,
	CONSTRAINT "email_reputation_metrics_emailDomainId_fkey" FOREIGN KEY ("emailDomainId") REFERENCES "email_domains"("emailDomainId") ON DELETE CASCADE,
	CONSTRAINT "email_reputation_metrics_emailDomainId_metricDate_unique" UNIQUE("emailDomainId", "metricDate")
);

CREATE INDEX IF NOT EXISTS "email_reputation_metrics_emailDomainId_idx" ON "email_reputation_metrics"("emailDomainId");
CREATE INDEX IF NOT EXISTS "email_reputation_metrics_metricDate_idx" ON "email_reputation_metrics"("metricDate");
CREATE INDEX IF NOT EXISTS "email_reputation_metrics_senderScore_idx" ON "email_reputation_metrics"("senderScore");

-- ==================== Email Sending Log ====================
CREATE TABLE IF NOT EXISTS "email_sending_log" (
	"logId" text PRIMARY KEY NOT NULL,
	"emailDomainId" text NOT NULL,
	"emailAccountId" text,
	"recipientEmail" text NOT NULL,
	"messageId" text,
	"status" text NOT NULL, -- 'sent', 'delivered', 'bounced', 'failed', 'deferred'
	"statusCode" text,
	"statusMessage" text,
	"sentAt" text NOT NULL,
	"deliveredAt" text,
	"bouncedAt" text,
	CONSTRAINT "email_sending_log_emailDomainId_fkey" FOREIGN KEY ("emailDomainId") REFERENCES "email_domains"("emailDomainId") ON DELETE CASCADE,
	CONSTRAINT "email_sending_log_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "email_accounts"("emailAccountId") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "email_sending_log_emailDomainId_idx" ON "email_sending_log"("emailDomainId");
CREATE INDEX IF NOT EXISTS "email_sending_log_emailAccountId_idx" ON "email_sending_log"("emailAccountId");
CREATE INDEX IF NOT EXISTS "email_sending_log_recipientEmail_idx" ON "email_sending_log"("recipientEmail");
CREATE INDEX IF NOT EXISTS "email_sending_log_status_idx" ON "email_sending_log"("status");
CREATE INDEX IF NOT EXISTS "email_sending_log_sentAt_idx" ON "email_sending_log"("sentAt");

