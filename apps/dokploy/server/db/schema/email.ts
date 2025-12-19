import {
  emailAccounts,
  emailAliases,
  emailDomains,
  emailForwards,
} from "@dokploy/server/db/schema";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Schema validation
const emailDomainSchema = createInsertSchema(emailDomains, {
  emailDomainId: z.string(),
  domain: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i, {
      message: "Invalid domain format",
    }),
  projectId: z.string().optional(),
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
  email: z.string().email(),
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

// API schemas
export const apiCreateEmailDomain = z.object({
  domain: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i, {
      message: "Invalid domain format",
    }),
  projectId: z.string().optional(),
  serverId: z.string().optional(),
  description: z.string().optional(),  webmailUrl: z.string().url().optional(),
  mailServerIp: z.string().ip().optional(),});

export const apiUpdateEmailDomain = z.object({
  emailDomainId: z.string().min(1),
  status: z.enum(["pending", "active", "suspended", "failed"]).optional(),
  description: z.string().optional(),
  webmailUrl: z.string().url().optional(),
  mailServerIp: z.string().ip().optional(),
});

export const apiFindOneEmailDomain = z.object({
  emailDomainId: z.string().min(1),
});

export const apiRemoveEmailDomain = z.object({
  emailDomainId: z.string().min(1),
});

export const apiCreateEmailAccount = z.object({
  username: z
    .string()
    .min(1)
    .regex(/^[a-z0-9._-]+$/i, {
      message:
        "Username can only contain letters, numbers, dots, hyphens, and underscores",
    }),
  emailDomainId: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().optional(),
  quota: z.number().min(0).max(102400).optional(), // Max 100GB
  enabled: z.boolean().optional(),
});

export const apiUpdateEmailAccount = z.object({
  emailAccountId: z.string().min(1),
  password: z.string().min(8).optional(),
  fullName: z.string().optional(),
  quota: z.number().min(0).max(102400).optional(),
  enabled: z.boolean().optional(),
  imapEnabled: z.boolean().optional(),
  pop3Enabled: z.boolean().optional(),
  smtpEnabled: z.boolean().optional(),
});

export const apiFindOneEmailAccount = z.object({
  emailAccountId: z.string().min(1),
});

export const apiRemoveEmailAccount = z.object({
  emailAccountId: z.string().min(1),
});

export const apiCreateEmailForward = z.object({
  sourceAddress: z.string().email(),
  destinationAddress: z.string().email(),
  emailDomainId: z.string().min(1),
});

export const apiUpdateEmailForward = z.object({
  emailForwardId: z.string().min(1),
  destinationAddress: z.string().email().optional(),
  enabled: z.boolean().optional(),
});

export const apiFindOneEmailForward = z.object({
  emailForwardId: z.string().min(1),
});

export const apiRemoveEmailForward = z.object({
  emailForwardId: z.string().min(1),
});

export const apiCreateEmailAlias = z.object({
  aliasAddress: z.string().min(1),
  destinationAddress: z.string().min(1), // username of the account
  emailDomainId: z.string().min(1),
});

export const apiUpdateEmailAlias = z.object({
  emailAliasId: z.string().min(1),
  enabled: z.boolean().optional(),
});

export const apiFindOneEmailAlias = z.object({
  emailAliasId: z.string().min(1),
});

export const apiRemoveEmailAlias = z.object({
  emailAliasId: z.string().min(1),
});

export const apiGenerateDKIMKeys = z.object({
  emailDomainId: z.string().min(1),
});

export const apiVerifyDNS = z.object({
  emailDomainId: z.string().min(1),
});
