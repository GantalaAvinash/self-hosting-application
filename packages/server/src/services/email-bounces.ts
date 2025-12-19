import { TRPCError } from "@trpc/server";
import { and, eq, sql, gte } from "drizzle-orm";
import { db } from "../db";
import { emailBounces, emailReputationMetrics } from "../db/schema";
import { addToSuppressionList } from "./email-suppressions";
import { updateReputationMetrics as updateReputationMetricsFromReputation } from "./email-reputation";

export type EmailBounce = typeof emailBounces.$inferSelect;

/**
 * Process a bounce event
 */
export const processBounce = async (input: {
  emailDomainId: string;
  emailAccountId?: string;
  recipientEmail: string;
  bounceType: "hard" | "soft" | "transient";
  bounceCode?: string;
  bounceMessage?: string;
}): Promise<EmailBounce> => {
  // Store bounce record
  const bounce = await db
    .insert(emailBounces)
    .values({
      emailDomainId: input.emailDomainId,
      emailAccountId: input.emailAccountId,
      recipientEmail: input.recipientEmail.toLowerCase().trim(),
      bounceType: input.bounceType,
      bounceCode: input.bounceCode,
      bounceMessage: input.bounceMessage,
      bouncedAt: new Date().toISOString(),
      processed: false,
    })
    .returning()
    .then((value) => value[0]);

  if (!bounce) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to record bounce",
    });
  }

  // If hard bounce, add to suppression list
  if (input.bounceType === "hard") {
    await addToSuppressionList({
      emailDomainId: input.emailDomainId,
      emailAddress: input.recipientEmail,
      suppressionType: "bounce",
      reason: input.bounceMessage || `Hard bounce: ${input.bounceCode || "unknown"}`,
    });
  }

  // Update reputation metrics (will recalculate bounce rate)
  await updateReputationMetricsFromReputation(input.emailDomainId);

  // Mark bounce as processed
  await db
    .update(emailBounces)
    .set({ processed: true })
    .where(eq(emailBounces.bounceId, bounce.bounceId));

  return bounce;
};

/**
 * Get bounce rate for a domain
 */
export const getDomainBounceRate = async (
  emailDomainId: string,
  days: number = 30
): Promise<number> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const metrics = await db.query.emailReputationMetrics.findFirst({
    where: and(
      eq(emailReputationMetrics.emailDomainId, emailDomainId),
      eq(
        emailReputationMetrics.metricDate,
        new Date().toISOString().split("T")[0]
      )
    ),
  });

  if (!metrics || metrics.totalSent === 0) {
    return 0;
  }

  // bounceRate is stored as integer (0-10000 for 0.0000-1.0000)
  return metrics.bounceRate / 10000;
};

/**
 * Update reputation metrics for a domain
 */
const updateReputationMetrics = async (emailDomainId: string) => {
  const today = new Date().toISOString().split("T")[0];

  // Get today's metrics or create new
  let metrics = await db.query.emailReputationMetrics.findFirst({
    where: and(
      eq(emailReputationMetrics.emailDomainId, emailDomainId),
      eq(emailReputationMetrics.metricDate, today)
    ),
  });

  // Count bounces for today
  const bounceCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailBounces)
    .where(
      and(
        eq(emailBounces.emailDomainId, emailDomainId),
        sql`${emailBounces.bouncedAt}::date = ${today}::date`
      )
    )
    .then((result) => Number(result[0]?.count || 0));

  if (!metrics) {
    // Create new metrics record
    metrics = await db
      .insert(emailReputationMetrics)
      .values({
        emailDomainId,
        metricDate: today,
        totalBounced: bounceCount,
        totalSent: 0, // Will be updated when emails are sent
        totalDelivered: 0,
        totalComplained: 0,
        bounceRate: 0,
        complaintRate: 0,
        deliveryRate: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning()
      .then((value) => value[0]);
  } else {
    // Update existing metrics
    metrics = await db
      .update(emailReputationMetrics)
      .set({
        totalBounced: bounceCount,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(emailReputationMetrics.metricId, metrics.metricId))
      .returning()
      .then((value) => value[0]);
  }

  if (metrics && metrics.totalSent > 0) {
    // Calculate bounce rate (stored as integer 0-10000)
    const bounceRate = Math.round(
      (metrics.totalBounced / metrics.totalSent) * 10000
    );

    await db
      .update(emailReputationMetrics)
      .set({
        bounceRate,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(emailReputationMetrics.metricId, metrics.metricId));
  }

  return metrics;
};

/**
 * Get all bounces for a domain
 */
export const getBouncesByDomainId = async (
  emailDomainId: string,
  limit: number = 100
) => {
  return await db.query.emailBounces.findMany({
    where: eq(emailBounces.emailDomainId, emailDomainId),
    orderBy: (emailBounces: any, { desc }: any) => [
      desc(emailBounces.bouncedAt),
    ],
    limit,
  });
};

/**
 * Alert if bounce rate exceeds threshold
 */
export const checkBounceRateThreshold = async (
  emailDomainId: string,
  threshold: number = 0.05 // 5%
): Promise<{ exceeded: boolean; rate: number }> => {
  const bounceRate = await getDomainBounceRate(emailDomainId, 1); // Last 24 hours

  return {
    exceeded: bounceRate > threshold,
    rate: bounceRate,
  };
};

