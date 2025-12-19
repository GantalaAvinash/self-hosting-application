import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { emailComplaints, emailReputationMetrics } from "../db/schema";
import { addToSuppressionList } from "./email-suppressions";
import { updateReputationMetrics } from "./email-reputation";

export type EmailComplaint = typeof emailComplaints.$inferSelect;

/**
 * Process a complaint event
 */
export const processComplaint = async (input: {
  emailDomainId: string;
  recipientEmail: string;
  complaintSource?: "feedback-loop" | "abuse-report" | "manual";
  messageId?: string;
  complaintDetails?: Record<string, any>;
}): Promise<EmailComplaint> => {
  // Store complaint record
  const complaint = await db
    .insert(emailComplaints)
    .values({
      emailDomainId: input.emailDomainId,
      recipientEmail: input.recipientEmail.toLowerCase().trim(),
      complaintSource: input.complaintSource || "manual",
      complaintDate: new Date().toISOString(),
      messageId: input.messageId,
      complaintDetails: input.complaintDetails
        ? JSON.stringify(input.complaintDetails)
        : null,
    })
    .returning()
    .then((value) => value[0]);

  if (!complaint) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to record complaint",
    });
  }

  // Always add to suppression list (complaints are serious)
  await addToSuppressionList({
    emailDomainId: input.emailDomainId,
    emailAddress: input.recipientEmail,
    suppressionType: "complaint",
    reason: `Complaint from ${input.complaintSource || "unknown source"}`,
  });

  // Update reputation metrics (will recalculate complaint rate)
  await updateReputationMetrics(input.emailDomainId);

  return complaint;
};

/**
 * Get complaint rate for a domain
 */
export const getDomainComplaintRate = async (
  emailDomainId: string,
  days: number = 30
): Promise<number> => {
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

  // complaintRate is stored as integer (0-10000 for 0.0000-1.0000)
  return metrics.complaintRate / 10000;
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

  // Count complaints for today
  const today = new Date().toISOString().split("T")[0];
  const complaintCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailComplaints)
    .where(
      and(
        eq(emailComplaints.emailDomainId, emailDomainId),
        sql`${emailComplaints.complaintDate}::date = ${today}::date`
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
        totalComplained: complaintCount,
        totalSent: 0, // Will be updated when emails are sent
        totalDelivered: 0,
        totalBounced: 0,
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
        totalComplained: complaintCount,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(emailReputationMetrics.metricId, metrics.metricId))
      .returning()
      .then((value) => value[0]);
  }

  if (metrics && metrics.totalSent > 0) {
    // Calculate complaint rate (stored as integer 0-10000)
    const complaintRate = Math.round(
      (metrics.totalComplained / metrics.totalSent) * 10000
    );

    await db
      .update(emailReputationMetrics)
      .set({
        complaintRate,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(emailReputationMetrics.metricId, metrics.metricId));
  }

  return metrics;
};

/**
 * Get all complaints for a domain
 */
export const getComplaintsByDomainId = async (
  emailDomainId: string,
  limit: number = 100
) => {
  return await db.query.emailComplaints.findMany({
    where: eq(emailComplaints.emailDomainId, emailDomainId),
    orderBy: (emailComplaints: any, { desc }: any) => [
      desc(emailComplaints.complaintDate),
    ],
    limit,
  });
};

/**
 * Alert if complaint rate exceeds threshold
 */
export const checkComplaintRateThreshold = async (
  emailDomainId: string,
  threshold: number = 0.001 // 0.1% (very low threshold for complaints)
): Promise<{ exceeded: boolean; rate: number }> => {
  const complaintRate = await getDomainComplaintRate(emailDomainId, 1); // Last 24 hours

  return {
    exceeded: complaintRate > threshold,
    rate: complaintRate,
  };
};

