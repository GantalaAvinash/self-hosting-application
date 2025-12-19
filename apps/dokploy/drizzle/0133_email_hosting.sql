-- Create email_domains table
CREATE TABLE IF NOT EXISTS "email_domains" (
	"emailDomainId" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"dnsVerified" boolean DEFAULT false NOT NULL,
	"mxPriority" integer DEFAULT 10 NOT NULL,
	"dkimSelector" text,
	"dkimPrivateKey" text,
	"dkimPublicKey" text,
	"projectId" text,
	"serverId" text,
	"organizationId" text NOT NULL,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL,
	CONSTRAINT "email_domains_domain_unique" UNIQUE("domain")
);

-- Create email_accounts table
CREATE TABLE IF NOT EXISTS "email_accounts" (
	"emailAccountId" text PRIMARY KEY NOT NULL,
	"emailDomainId" text NOT NULL,
	"username" text NOT NULL,
	"passwordHash" text NOT NULL,
	"fullName" text,
	"quota" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL,
	CONSTRAINT "email_accounts_emailDomainId_username_unique" UNIQUE("emailDomainId","username")
);

-- Create email_forwards table
CREATE TABLE IF NOT EXISTS "email_forwards" (
	"emailForwardId" text PRIMARY KEY NOT NULL,
	"emailDomainId" text NOT NULL,
	"sourceAddress" text NOT NULL,
	"destinationAddress" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL,
	CONSTRAINT "email_forwards_emailDomainId_sourceAddress_unique" UNIQUE("emailDomainId","sourceAddress")
);

-- Create email_aliases table
CREATE TABLE IF NOT EXISTS "email_aliases" (
	"emailAliasId" text PRIMARY KEY NOT NULL,
	"emailDomainId" text NOT NULL,
	"emailAccountId" text NOT NULL,
	"aliasAddress" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL,
	CONSTRAINT "email_aliases_emailDomainId_aliasAddress_unique" UNIQUE("emailDomainId","aliasAddress")
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "email_domains" ADD CONSTRAINT "email_domains_projectId_project_projectId_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("projectId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "email_domains" ADD CONSTRAINT "email_domains_serverId_server_serverId_fk" FOREIGN KEY ("serverId") REFERENCES "public"."server"("serverId") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "email_domains" ADD CONSTRAINT "email_domains_organizationId_organization_organizationId_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("organizationId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_emailDomainId_email_domains_emailDomainId_fk" FOREIGN KEY ("emailDomainId") REFERENCES "public"."email_domains"("emailDomainId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "email_forwards" ADD CONSTRAINT "email_forwards_emailDomainId_email_domains_emailDomainId_fk" FOREIGN KEY ("emailDomainId") REFERENCES "public"."email_domains"("emailDomainId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "email_aliases" ADD CONSTRAINT "email_aliases_emailDomainId_email_domains_emailDomainId_fk" FOREIGN KEY ("emailDomainId") REFERENCES "public"."email_domains"("emailDomainId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "email_aliases" ADD CONSTRAINT "email_aliases_emailAccountId_email_accounts_emailAccountId_fk" FOREIGN KEY ("emailAccountId") REFERENCES "public"."email_accounts"("emailAccountId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "email_domains_organizationId_idx" ON "email_domains" ("organizationId");
CREATE INDEX IF NOT EXISTS "email_domains_projectId_idx" ON "email_domains" ("projectId");
CREATE INDEX IF NOT EXISTS "email_accounts_emailDomainId_idx" ON "email_accounts" ("emailDomainId");
CREATE INDEX IF NOT EXISTS "email_forwards_emailDomainId_idx" ON "email_forwards" ("emailDomainId");
CREATE INDEX IF NOT EXISTS "email_aliases_emailDomainId_idx" ON "email_aliases" ("emailDomainId");
CREATE INDEX IF NOT EXISTS "email_aliases_emailAccountId_idx" ON "email_aliases" ("emailAccountId");
