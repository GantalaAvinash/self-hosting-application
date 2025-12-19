-- Add webmailUrl and mailServerIp fields to email_domains table
ALTER TABLE "email_domains" ADD COLUMN "webmailUrl" text;
ALTER TABLE "email_domains" ADD COLUMN "mailServerIp" text;
