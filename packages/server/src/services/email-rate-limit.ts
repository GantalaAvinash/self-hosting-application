import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { emailRateLimits } from "../db/schema";

export type EmailRateLimit = typeof emailRateLimits.$inferSelect;

// Default rate limits
export const DEFAULT_RATE_LIMITS = {
  daily: 1000, // 1000 emails per day per account
  hourly: 100, // 100 emails per hour per account
  per_minute: 10, // 10 emails per minute per account
};

/**
 * Get or create rate limit record
 */
const getOrCreateRateLimit = async (
  emailDomainId: string,
  emailAccountId: string | undefined,
  limitType: "daily" | "hourly" | "per_minute"
): Promise<EmailRateLimit> => {
  const now = new Date();
  let resetAt: Date;

  switch (limitType) {
    case "daily":
      resetAt = new Date(now);
      resetAt.setDate(resetAt.getDate() + 1);
      resetAt.setHours(0, 0, 0, 0);
      break;
    case "hourly":
      resetAt = new Date(now);
      resetAt.setHours(resetAt.getHours() + 1, 0, 0, 0);
      break;
    case "per_minute":
      resetAt = new Date(now);
      resetAt.setMinutes(resetAt.getMinutes() + 1, 0, 0);
      break;
  }

  // Check if limit exists
  const existing = await db.query.emailRateLimits.findFirst({
    where: and(
      eq(emailRateLimits.emailDomainId, emailDomainId),
      emailAccountId
        ? eq(emailRateLimits.emailAccountId, emailAccountId)
        : sql`${emailRateLimits.emailAccountId} IS NULL`,
      eq(emailRateLimits.limitType, limitType)
    ),
  });

  if (existing) {
    // Check if reset time has passed
    const resetTime = new Date(existing.resetAt);
    if (now >= resetTime) {
      // Reset counter
      return await db
        .update(emailRateLimits)
        .set({
          currentCount: 0,
          resetAt: resetAt.toISOString(),
          updatedAt: now.toISOString(),
        })
        .where(eq(emailRateLimits.rateLimitId, existing.rateLimitId))
        .returning()
        .then((value) => value[0]);
    }
    return existing;
  }

  // Create new rate limit
  const limitValue =
    DEFAULT_RATE_LIMITS[limitType] ||
    (limitType === "daily" ? 1000 : limitType === "hourly" ? 100 : 10);

  const newLimit = await db
    .insert(emailRateLimits)
    .values({
      emailDomainId,
      emailAccountId: emailAccountId || null,
      limitType,
      limitValue,
      currentCount: 0,
      resetAt: resetAt.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })
    .returning()
    .then((value) => value[0]);

  if (!newLimit) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create rate limit",
    });
  }

  return newLimit;
};

/**
 * Check if rate limit is exceeded
 */
export const checkRateLimit = async (
  emailDomainId: string,
  emailAccountId: string | undefined,
  limitType: "daily" | "hourly" | "per_minute" = "daily"
): Promise<void> => {
  const limit = await getOrCreateRateLimit(
    emailDomainId,
    emailAccountId,
    limitType
  );

  if (limit.currentCount >= limit.limitValue) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. Limit: ${limit.limitValue} emails per ${limitType.replace("_", " ")}`,
    });
  }
};

/**
 * Increment rate limit counter
 */
export const incrementRateLimit = async (
  emailDomainId: string,
  emailAccountId: string | undefined,
  limitType: "daily" | "hourly" | "per_minute" = "daily",
  amount: number = 1
): Promise<void> => {
  const limit = await getOrCreateRateLimit(
    emailDomainId,
    emailAccountId,
    limitType
  );

  await db
    .update(emailRateLimits)
    .set({
      currentCount: sql`${emailRateLimits.currentCount} + ${amount}`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(emailRateLimits.rateLimitId, limit.rateLimitId));
};

/**
 * Get current rate limit status
 */
export const getRateLimitStatus = async (
  emailDomainId: string,
  emailAccountId: string | undefined,
  limitType: "daily" | "hourly" | "per_minute" = "daily"
): Promise<{ current: number; limit: number; resetAt: string }> => {
  const limit = await getOrCreateRateLimit(
    emailDomainId,
    emailAccountId,
    limitType
  );

  return {
    current: limit.currentCount,
    limit: limit.limitValue,
    resetAt: limit.resetAt,
  };
};

/**
 * Set custom rate limit for domain/account
 */
export const setRateLimit = async (
  emailDomainId: string,
  emailAccountId: string | undefined,
  limitType: "daily" | "hourly" | "per_minute",
  limitValue: number
): Promise<EmailRateLimit> => {
  const limit = await getOrCreateRateLimit(
    emailDomainId,
    emailAccountId,
    limitType
  );

  const updated = await db
    .update(emailRateLimits)
    .set({
      limitValue,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(emailRateLimits.rateLimitId, limit.rateLimitId))
    .returning()
    .then((value) => value[0]);

  if (!updated) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to update rate limit",
    });
  }

  return updated;
};

