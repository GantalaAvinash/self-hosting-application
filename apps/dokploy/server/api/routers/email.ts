import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  apiCreateEmailAccount,
  apiCreateEmailAlias,
  apiCreateEmailDomain,
  apiCreateEmailForward,
  apiFindOneEmailAccount,
  apiFindOneEmailAlias,
  apiFindOneEmailDomain,
  apiFindOneEmailForward,
  apiGenerateDKIMKeys,
  apiRemoveEmailAccount,
  apiRemoveEmailAlias,
  apiRemoveEmailDomain,
  apiRemoveEmailForward,
  apiUpdateEmailAccount,
  apiUpdateEmailAlias,
  apiUpdateEmailDomain,
  apiUpdateEmailForward,
  apiVerifyDNS,
} from "@/server/db/schema";
import {
  createEmailAccount,
  createEmailAlias,
  createEmailDomain,
  createEmailForward,
  findEmailAccountById,
  findEmailAccountsByDomainId,
  findEmailAliasById,
  findEmailAliasesByAccountId,
  findEmailAliasesByDomainId,
  findEmailDomainById,
  findEmailDomainsByOrganizationId,
  findEmailDomainsByProjectId,
  findEmailForwardById,
  findEmailForwardsByDomainId,
  generateDKIMKeys,
  getDNSRecords,
  getEmailAccountConnectionInfo,
  removeEmailAccount,
  removeEmailAlias,
  removeEmailDomain,
  removeEmailForward,
  updateEmailAccount,
  updateEmailAlias,
  updateEmailDomain,
  updateEmailForward,
  verifyDNSRecords,
} from "@dokploy/server";
import {
  addNewService,
  checkEmailAccountAccess,
  checkEmailAliasAccess,
  checkEmailDomainAccess,
  checkEmailForwardAccess,
} from "@dokploy/server/services/user";
import {
  getBouncesByDomainId,
  getDomainBounceRate,
  checkBounceRateThreshold,
} from "@dokploy/server/services/email-bounces";
import {
  getComplaintsByDomainId,
  getDomainComplaintRate,
  checkComplaintRateThreshold,
  processComplaint,
} from "@dokploy/server/services/email-complaints";
import {
  getSuppressionsByDomainId,
  addToSuppressionList,
  removeFromSuppressionList,
  checkSuppressionList,
} from "@dokploy/server/services/email-suppressions";
import {
  getRateLimitStatus,
  setRateLimit,
} from "@dokploy/server/services/email-rate-limit";
import {
  getReputationSummary,
  checkReputationThresholds,
  checkIPBlacklist,
  updateReputationMetrics,
} from "@dokploy/server/services/email-reputation";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const emailRouter = createTRPCRouter({
  // ==================== Email Domain Routes ====================
  createDomain: protectedProcedure
    .input(apiCreateEmailDomain)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          null,
          ctx.session.activeOrganizationId,
          "create"
        );
      }
      const newDomain = await createEmailDomain(
        input,
        ctx.session.activeOrganizationId
      );

      // Add email domain to member's accessedServices if member
      if (ctx.user.role === "member") {
        await addNewService(
          ctx.user.id,
          newDomain.emailDomainId,
          ctx.session.activeOrganizationId
        );
      }

      return newDomain;
    }),

  getDomain: protectedProcedure
    .input(apiFindOneEmailDomain)
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      const domain = await findEmailDomainById(input.emailDomainId);

      if (domain.organizationId !== ctx.session.activeOrganizationId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to access this email domain",
        });
      }

      return domain;
    }),

  getDomainsByProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          null,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      return await findEmailDomainsByProjectId(input.projectId);
    }),

  getAllDomains: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "member") {
      await checkEmailDomainAccess(
        ctx.user.id,
        null,
        ctx.session.activeOrganizationId,
        "access"
      );
    }
    const domains = await findEmailDomainsByOrganizationId(
      ctx.session.activeOrganizationId
    );

    // Filter domains based on accessedServices for members
    if (ctx.user.role === "member") {
      const { findMemberById } = await import("@dokploy/server/services/user");
      const member = await findMemberById(
        ctx.user.id,
        ctx.session.activeOrganizationId
      );
      return domains.filter((domain) =>
        member.accessedServices.includes(domain.emailDomainId)
      );
    }

    return domains;
  }),

  updateDomain: protectedProcedure
    .input(apiUpdateEmailDomain)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      const domain = await findEmailDomainById(input.emailDomainId);

      if (domain.organizationId !== ctx.session.activeOrganizationId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to update this email domain",
        });
      }

      return await updateEmailDomain(input.emailDomainId, input);
    }),

  removeDomain: protectedProcedure
    .input(apiRemoveEmailDomain)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "delete"
        );
      }
      const domain = await findEmailDomainById(input.emailDomainId);

      if (domain.organizationId !== ctx.session.activeOrganizationId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to delete this email domain",
        });
      }

      return await removeEmailDomain(input.emailDomainId);
    }),

  generateDKIM: protectedProcedure
    .input(apiGenerateDKIMKeys)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      const domain = await findEmailDomainById(input.emailDomainId);

      if (domain.organizationId !== ctx.session.activeOrganizationId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to generate DKIM keys",
        });
      }

      return await generateDKIMKeys(input.emailDomainId);
    }),

  verifyDNS: protectedProcedure
    .input(apiVerifyDNS)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      const domain = await findEmailDomainById(input.emailDomainId);

      if (domain.organizationId !== ctx.session.activeOrganizationId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to verify DNS records",
        });
      }

      return await verifyDNSRecords(input.emailDomainId);
    }),

  getDNSRecords: protectedProcedure
    .input(apiFindOneEmailDomain)
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      const domain = await findEmailDomainById(input.emailDomainId);

      if (domain.organizationId !== ctx.session.activeOrganizationId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to access DNS records",
        });
      }

      return await getDNSRecords(input.emailDomainId);
    }),

  // ==================== Email Account Routes ====================
  createAccount: protectedProcedure
    .input(apiCreateEmailAccount)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailAccountAccess(
          ctx.user.id,
          null,
          ctx.session.activeOrganizationId,
          "create"
        );
      }
      const domain = await findEmailDomainById(input.emailDomainId);

      if (domain.organizationId !== ctx.session.activeOrganizationId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to create email accounts",
        });
      }

      return await createEmailAccount(input);
    }),

  getAccount: protectedProcedure
    .input(apiFindOneEmailAccount)
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailAccountAccess(
          ctx.user.id,
          input.emailAccountId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      const account = await findEmailAccountById(input.emailAccountId);

      if (
        (account.emailDomain as any).organizationId !==
        ctx.session.activeOrganizationId
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to access this email account",
        });
      }

      return account;
    }),

  getAccountsByDomain: protectedProcedure
    .input(z.object({ emailDomainId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      const domain = await findEmailDomainById(input.emailDomainId);

      if (domain.organizationId !== ctx.session.activeOrganizationId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to access these email accounts",
        });
      }

      return await findEmailAccountsByDomainId(input.emailDomainId);
    }),

  updateAccount: protectedProcedure
    .input(apiUpdateEmailAccount)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailAccountAccess(
          ctx.user.id,
          input.emailAccountId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      const account = await findEmailAccountById(input.emailAccountId);

      if (
        (account.emailDomain as any).organizationId !==
        ctx.session.activeOrganizationId
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to update this email account",
        });
      }

      return await updateEmailAccount(input.emailAccountId, input);
    }),

  removeAccount: protectedProcedure
    .input(apiRemoveEmailAccount)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailAccountAccess(
          ctx.user.id,
          input.emailAccountId,
          ctx.session.activeOrganizationId,
          "delete"
        );
      }
      const account = await findEmailAccountById(input.emailAccountId);

      if (
        (account.emailDomain as any).organizationId !==
        ctx.session.activeOrganizationId
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to delete this email account",
        });
      }

      return await removeEmailAccount(input.emailAccountId);
    }),

  getAccountConnectionInfo: protectedProcedure
    .input(apiFindOneEmailAccount)
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailAccountAccess(
          ctx.user.id,
          input.emailAccountId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      const account = await findEmailAccountById(input.emailAccountId);

      if (
        (account.emailDomain as any).organizationId !==
        ctx.session.activeOrganizationId
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to access this email account",
        });
      }

      return getEmailAccountConnectionInfo(account, account.emailDomain as any);
    }),

  // ==================== Email Forward Routes ====================
  createForward: protectedProcedure
    .input(apiCreateEmailForward)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailForwardAccess(
          ctx.user.id,
          null,
          ctx.session.activeOrganizationId,
          "create"
        );
      }
      const domain = await findEmailDomainById(input.emailDomainId);

      if (domain.organizationId !== ctx.session.activeOrganizationId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to create email forwards",
        });
      }

      return await createEmailForward(input);
    }),

  getForward: protectedProcedure
    .input(apiFindOneEmailForward)
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailForwardAccess(
          ctx.user.id,
          input.emailForwardId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      const forward = await findEmailForwardById(input.emailForwardId);

      if (
        (forward.emailDomain as any).organizationId !==
        ctx.session.activeOrganizationId
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to access this email forward",
        });
      }

      return forward;
    }),

  getForwardsByDomain: protectedProcedure
    .input(z.object({ emailDomainId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      const domain = await findEmailDomainById(input.emailDomainId);

      if (domain.organizationId !== ctx.session.activeOrganizationId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to access these email forwards",
        });
      }

      return await findEmailForwardsByDomainId(input.emailDomainId);
    }),

  updateForward: protectedProcedure
    .input(apiUpdateEmailForward)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailForwardAccess(
          ctx.user.id,
          input.emailForwardId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      const forward = await findEmailForwardById(input.emailForwardId);

      if (
        (forward.emailDomain as any).organizationId !==
        ctx.session.activeOrganizationId
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to update this email forward",
        });
      }

      return await updateEmailForward(input.emailForwardId, input);
    }),

  removeForward: protectedProcedure
    .input(apiRemoveEmailForward)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailForwardAccess(
          ctx.user.id,
          input.emailForwardId,
          ctx.session.activeOrganizationId,
          "delete"
        );
      }
      const forward = await findEmailForwardById(input.emailForwardId);

      if (
        (forward.emailDomain as any).organizationId !==
        ctx.session.activeOrganizationId
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to delete this email forward",
        });
      }

      return await removeEmailForward(input.emailForwardId);
    }),

  // ==================== Email Alias Routes ====================
  createAlias: protectedProcedure
    .input(apiCreateEmailAlias)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailAliasAccess(
          ctx.user.id,
          null,
          ctx.session.activeOrganizationId,
          "create"
        );
      }
      const domain = await findEmailDomainById(input.emailDomainId);

      if (domain.organizationId !== ctx.session.activeOrganizationId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to create email aliases",
        });
      }

      return await createEmailAlias(input);
    }),

  getAlias: protectedProcedure
    .input(apiFindOneEmailAlias)
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailAliasAccess(
          ctx.user.id,
          input.emailAliasId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      const alias = await findEmailAliasById(input.emailAliasId);

      if (
        (alias.emailDomain as any).organizationId !==
        ctx.session.activeOrganizationId
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to access this email alias",
        });
      }

      return alias;
    }),

  getAliasesByDomain: protectedProcedure
    .input(z.object({ emailDomainId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      const domain = await findEmailDomainById(input.emailDomainId);

      if (domain.organizationId !== ctx.session.activeOrganizationId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to access these email aliases",
        });
      }

      return await findEmailAliasesByDomainId(input.emailDomainId);
    }),

  getAliasesByAccount: protectedProcedure
    .input(z.object({ emailAccountId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailAccountAccess(
          ctx.user.id,
          input.emailAccountId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      const account = await findEmailAccountById(input.emailAccountId);

      if (
        (account.emailDomain as any).organizationId !==
        ctx.session.activeOrganizationId
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to access these email aliases",
        });
      }

      return await findEmailAliasesByAccountId(input.emailAccountId);
    }),

  updateAlias: protectedProcedure
    .input(apiUpdateEmailAlias)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailAliasAccess(
          ctx.user.id,
          input.emailAliasId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      const alias = await findEmailAliasById(input.emailAliasId);

      if (
        (alias.emailDomain as any).organizationId !==
        ctx.session.activeOrganizationId
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to update this email alias",
        });
      }

      return await updateEmailAlias(input.emailAliasId, input);
    }),

  removeAlias: protectedProcedure
    .input(apiRemoveEmailAlias)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailAliasAccess(
          ctx.user.id,
          input.emailAliasId,
          ctx.session.activeOrganizationId,
          "delete"
        );
      }
      const alias = await findEmailAliasById(input.emailAliasId);

      if (
        (alias.emailDomain as any).organizationId !==
        ctx.session.activeOrganizationId
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to delete this email alias",
        });
      }

      return await removeEmailAlias(input.emailAliasId);
    }),

  // ==================== Mail Server Health ====================
  checkMailServerHealth: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "member") {
      await checkEmailDomainAccess(
        ctx.user.id,
        null,
        ctx.session.activeOrganizationId,
        "access"
      );
    }
    const { checkMailServerHealth } = await import(
      "@dokploy/server/utils/mail-server"
    );
    return await checkMailServerHealth();
  }),

  // ==================== Bounce Management ====================
  getBounces: protectedProcedure
    .input(z.object({ emailDomainId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      return await getBouncesByDomainId(input.emailDomainId);
    }),

  getBounceRate: protectedProcedure
    .input(z.object({ emailDomainId: z.string(), days: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      return await getDomainBounceRate(input.emailDomainId, input.days);
    }),

  checkBounceRate: protectedProcedure
    .input(
      z.object({
        emailDomainId: z.string(),
        threshold: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      return await checkBounceRateThreshold(
        input.emailDomainId,
        input.threshold
      );
    }),

  // ==================== Complaint Management ====================
  getComplaints: protectedProcedure
    .input(z.object({ emailDomainId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      return await getComplaintsByDomainId(input.emailDomainId);
    }),

  getComplaintRate: protectedProcedure
    .input(z.object({ emailDomainId: z.string(), days: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      return await getDomainComplaintRate(input.emailDomainId, input.days);
    }),

  checkComplaintRate: protectedProcedure
    .input(
      z.object({
        emailDomainId: z.string(),
        threshold: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      return await checkComplaintRateThreshold(
        input.emailDomainId,
        input.threshold
      );
    }),

  // ==================== Suppression List ====================
  getSuppressions: protectedProcedure
    .input(z.object({ emailDomainId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      return await getSuppressionsByDomainId(input.emailDomainId);
    }),

  addSuppression: protectedProcedure
    .input(
      z.object({
        emailDomainId: z.string(),
        emailAddress: z.string().email(),
        suppressionType: z.enum(["bounce", "complaint", "unsubscribe", "manual"]),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      return await addToSuppressionList(input);
    }),

  removeSuppression: protectedProcedure
    .input(
      z.object({
        emailDomainId: z.string(),
        emailAddress: z.string().email(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      return await removeFromSuppressionList(
        input.emailDomainId,
        input.emailAddress
      );
    }),

  // ==================== Rate Limiting ====================
  getRateLimitStatus: protectedProcedure
    .input(
      z.object({
        emailDomainId: z.string(),
        emailAccountId: z.string().optional(),
        limitType: z.enum(["daily", "hourly", "per_minute"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      return await getRateLimitStatus(
        input.emailDomainId,
        input.emailAccountId,
        input.limitType || "daily"
      );
    }),

  setRateLimit: protectedProcedure
    .input(
      z.object({
        emailDomainId: z.string(),
        emailAccountId: z.string().optional(),
        limitType: z.enum(["daily", "hourly", "per_minute"]),
        limitValue: z.number().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      return await setRateLimit(
        input.emailDomainId,
        input.emailAccountId,
        input.limitType,
        input.limitValue
      );
    }),

  // ==================== Reputation Management ====================
  getReputation: protectedProcedure
    .input(z.object({ emailDomainId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      return await getReputationSummary(input.emailDomainId);
    }),

  checkReputation: protectedProcedure
    .input(z.object({ emailDomainId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        await checkEmailDomainAccess(
          ctx.user.id,
          input.emailDomainId,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      return await checkReputationThresholds(input.emailDomainId);
    }),

  checkIPReputation: protectedProcedure
    .input(z.object({ ip: z.string().ip() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role === "member") {
        // Only allow IP reputation checks for members with email access
        await checkEmailDomainAccess(
          ctx.user.id,
          null,
          ctx.session.activeOrganizationId,
          "access"
        );
      }
      return await checkIPBlacklist(input.ip);
    }),
});
