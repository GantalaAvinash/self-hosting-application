import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { organization } from "./account";
import { projects } from "./project";
import { server } from "./server";

// Email domain status
export const emailDomainStatus = pgEnum("emailDomainStatus", [
  "pending",
  "active",
  "suspended",
  "failed",
]);

// Email domains table
export const emailDomains = pgTable(
  "email_domains",
  {
    emailDomainId: text("emailDomainId")
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    domain: text("domain").notNull(),
    description: text("description"),
    status: emailDomainStatus("status").notNull().default("pending"),
    dnsVerified: boolean("dnsVerified").notNull().default(false),
    dkimSelector: text("dkimSelector"),
    dkimPrivateKey: text("dkimPrivateKey"),
    dkimPublicKey: text("dkimPublicKey"),
    mxPriority: integer("mxPriority").notNull().default(10),
    webmailUrl: text("webmailUrl"),
    mailServerIp: text("mailServerIp"),
    createdAt: text("createdAt")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    projectId: text("projectId").references(() => projects.projectId, {
      onDelete: "cascade",
    }),
    serverId: text("serverId").references(() => server.serverId, {
      onDelete: "set null",
    }),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
  },
  (t: any) => ({
    unq: unique().on(t.domain),
  })
);

export const emailDomainsRelations = relations(
  emailDomains,
  ({ one, many }: { one: any; many: any }) => ({
    project: one(projects, {
      fields: [emailDomains.projectId],
      references: [projects.projectId],
    }),
    server: one(server, {
      fields: [emailDomains.serverId],
      references: [server.serverId],
    }),
    organization: one(organization, {
      fields: [emailDomains.organizationId],
      references: [organization.id],
    }),
    accounts: many(emailAccounts),
    forwards: many(emailForwards),
    aliases: many(emailAliases),
  })
);

// Email accounts table
export const emailAccounts = pgTable(
  "email_accounts",
  {
    emailAccountId: text("emailAccountId")
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    emailDomainId: text("emailDomainId")
      .notNull()
      .references(() => emailDomains.emailDomainId, { onDelete: "cascade" }),
    username: text("username").notNull(),
    passwordHash: text("passwordHash").notNull(),
    fullName: text("fullName"),
    quota: integer("quota"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: text("createdAt")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t: any) => ({
    unq: unique().on(t.emailDomainId, t.username),
  })
);

export const emailAccountsRelations = relations(
  emailAccounts,
  ({ one, many }: { one: any; many: any }) => ({
    emailDomain: one(emailDomains, {
      fields: [emailAccounts.emailDomainId],
      references: [emailDomains.emailDomainId],
    }),
    aliases: many(emailAliases),
  })
);

// Email forwards table
export const emailForwards = pgTable(
  "email_forwards",
  {
    emailForwardId: text("emailForwardId")
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    sourceAddress: text("sourceAddress").notNull(),
    destinationAddress: text("destinationAddress").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: text("createdAt")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    emailDomainId: text("emailDomainId")
      .notNull()
      .references(() => emailDomains.emailDomainId, { onDelete: "cascade" }),
  },
  (t: any) => ({
    unq: unique().on(t.emailDomainId, t.sourceAddress),
  })
);

export const emailForwardsRelations = relations(
  emailForwards,
  ({ one }: { one: any }) => ({
    emailDomain: one(emailDomains, {
      fields: [emailForwards.emailDomainId],
      references: [emailDomains.emailDomainId],
    }),
  })
);

// Email aliases table
export const emailAliases = pgTable(
  "email_aliases",
  {
    emailAliasId: text("emailAliasId")
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    emailDomainId: text("emailDomainId")
      .notNull()
      .references(() => emailDomains.emailDomainId, { onDelete: "cascade" }),
    emailAccountId: text("emailAccountId")
      .notNull()
      .references(() => emailAccounts.emailAccountId, { onDelete: "cascade" }),
    aliasAddress: text("aliasAddress").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: text("createdAt")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t: any) => ({
    unq: unique().on(t.emailDomainId, t.aliasAddress),
  })
);

export const emailAliasesRelations = relations(
  emailAliases,
  ({ one }: { one: any }) => ({
    emailAccount: one(emailAccounts, {
      fields: [emailAliases.emailAccountId],
      references: [emailAccounts.emailAccountId],
    }),
    emailDomain: one(emailDomains, {
      fields: [emailAliases.emailDomainId],
      references: [emailDomains.emailDomainId],
    }),
  })
);

// ==================== Email Deliverability Tables ====================

// Email bounces table
export const emailBounces = pgTable("email_bounces", {
  bounceId: text("bounceId")
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  emailDomainId: text("emailDomainId")
    .notNull()
    .references(() => emailDomains.emailDomainId, { onDelete: "cascade" }),
  emailAccountId: text("emailAccountId").references(
    () => emailAccounts.emailAccountId,
    { onDelete: "set null" }
  ),
  recipientEmail: text("recipientEmail").notNull(),
  bounceType: text("bounceType").notNull(), // 'hard', 'soft', 'transient'
  bounceCode: text("bounceCode"),
  bounceMessage: text("bounceMessage"),
  bouncedAt: text("bouncedAt")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  processed: boolean("processed").notNull().default(false),
});

// Email complaints table
export const emailComplaints = pgTable("email_complaints", {
  complaintId: text("complaintId")
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  emailDomainId: text("emailDomainId")
    .notNull()
    .references(() => emailDomains.emailDomainId, { onDelete: "cascade" }),
  recipientEmail: text("recipientEmail").notNull(),
  complaintSource: text("complaintSource"), // 'feedback-loop', 'abuse-report', 'manual'
  complaintDate: text("complaintDate")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  messageId: text("messageId"),
  complaintDetails: text("complaintDetails"), // JSON string
});

// Email suppressions table
export const emailSuppressions = pgTable(
  "email_suppressions",
  {
    suppressionId: text("suppressionId")
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    emailDomainId: text("emailDomainId")
      .notNull()
      .references(() => emailDomains.emailDomainId, { onDelete: "cascade" }),
    emailAddress: text("emailAddress").notNull(),
    suppressionType: text("suppressionType").notNull(), // 'bounce', 'complaint', 'unsubscribe', 'manual'
    suppressedAt: text("suppressedAt")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    reason: text("reason"),
  },
  (t: any) => ({
    unq: unique().on(t.emailDomainId, t.emailAddress),
  })
);

// Email rate limits table
export const emailRateLimits = pgTable("email_rate_limits", {
  rateLimitId: text("rateLimitId")
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  emailDomainId: text("emailDomainId")
    .notNull()
    .references(() => emailDomains.emailDomainId, { onDelete: "cascade" }),
  emailAccountId: text("emailAccountId").references(
    () => emailAccounts.emailAccountId,
    { onDelete: "cascade" }
  ),
  limitType: text("limitType").notNull(), // 'daily', 'hourly', 'per_minute'
  limitValue: integer("limitValue").notNull(),
  currentCount: integer("currentCount").notNull().default(0),
  resetAt: text("resetAt").notNull(),
  createdAt: text("createdAt")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updatedAt")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// Email reputation metrics table
export const emailReputationMetrics = pgTable(
  "email_reputation_metrics",
  {
    metricId: text("metricId")
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    emailDomainId: text("emailDomainId")
      .notNull()
      .references(() => emailDomains.emailDomainId, { onDelete: "cascade" }),
    metricDate: text("metricDate").notNull(), // YYYY-MM-DD format
    totalSent: integer("totalSent").notNull().default(0),
    totalDelivered: integer("totalDelivered").notNull().default(0),
    totalBounced: integer("totalBounced").notNull().default(0),
    totalComplained: integer("totalComplained").notNull().default(0),
    bounceRate: integer("bounceRate").notNull().default(0), // Stored as integer (0-10000 for 0.0000-1.0000)
    complaintRate: integer("complaintRate").notNull().default(0),
    deliveryRate: integer("deliveryRate").notNull().default(0),
    senderScore: integer("senderScore"),
    blacklistStatus: text("blacklistStatus"), // JSON string
    createdAt: text("createdAt")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t: any) => ({
    unq: unique().on(t.emailDomainId, t.metricDate),
  })
);

// Email sending log table
export const emailSendingLog = pgTable("email_sending_log", {
  logId: text("logId")
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  emailDomainId: text("emailDomainId")
    .notNull()
    .references(() => emailDomains.emailDomainId, { onDelete: "cascade" }),
  emailAccountId: text("emailAccountId").references(
    () => emailAccounts.emailAccountId,
    { onDelete: "set null" }
  ),
  recipientEmail: text("recipientEmail").notNull(),
  messageId: text("messageId"),
  status: text("status").notNull(), // 'sent', 'delivered', 'bounced', 'failed', 'deferred'
  statusCode: text("statusCode"),
  statusMessage: text("statusMessage"),
  sentAt: text("sentAt")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  deliveredAt: text("deliveredAt"),
  bouncedAt: text("bouncedAt"),
});

// Schema validation
const emailDomainSchema = createInsertSchema(emailDomains, {
  emailDomainId: z.string(),
  domain: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i, {
      message: "Invalid domain format",
    }),
  projectId: z.string().min(1),
});

const emailAccountSchema = createInsertSchema(emailAccounts, {
  emailAccountId: z.string(),
  username: z
    .string()
    .min(1)
    .regex(/^[a-z0-9._-]+$/i, {
      message:
        "Username can only contain letters, numbers, dots, hyphens, and underscores",
    }),
  quota: z.number().min(0).max(102400), // Max 100GB
  emailDomainId: z.string().min(1),
});

const emailForwardSchema = createInsertSchema(emailForwards, {
  emailForwardId: z.string(),
  sourceAddress: z.string().email(),
  destinationAddress: z.string().email(),
  emailDomainId: z.string().min(1),
});

const emailAliasSchema = createInsertSchema(emailAliases, {
  emailAliasId: z.string(),
  aliasAddress: z.string().email(),
  emailAccountId: z.string().min(1),
  emailDomainId: z.string().min(1),
});

// API validation schemas are defined in apps/dokploy/server/db/schema/email.ts to avoid circular dependencies
