-- Add email permissions to member table
ALTER TABLE "member" 
ADD COLUMN IF NOT EXISTS "canAccessToEmail" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "canCreateEmailDomains" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "canDeleteEmailDomains" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "canCreateEmailAccounts" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "canDeleteEmailAccounts" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "canManageEmailForwards" boolean NOT NULL DEFAULT false;

-- Grant all email permissions to owners and admins
UPDATE "member" 
SET 
  "canAccessToEmail" = true,
  "canCreateEmailDomains" = true,
  "canDeleteEmailDomains" = true,
  "canCreateEmailAccounts" = true,
  "canDeleteEmailAccounts" = true,
  "canManageEmailForwards" = true
WHERE "role" IN ('owner', 'admin');

