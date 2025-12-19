import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { emailReputationMetrics } from "../db/schema";
import { execAsync } from "../utils/process/execAsync";

export type EmailReputationMetric = typeof emailReputationMetrics.$inferSelect;

/**
 * Check IP against blacklists
 */
export const checkIPBlacklist = async (ip: string): Promise<{
  blacklisted: boolean;
  blacklists: string[];
  details: Array<{ name: string; listed: boolean }>;
}> => {
  const blacklists = [
    { name: "Spamhaus ZEN", host: "zen.spamhaus.org" },
    { name: "SpamCop", host: "bl.spamcop.net" },
    { name: "SORBS", host: "dnsbl.sorbs.net" },
    { name: "Barracuda", host: "b.barracudacentral.org" },
  ];

  const results = await Promise.all(
    blacklists.map(async (bl) => {
      try {
        // Reverse IP for DNSBL lookup (e.g., 192.0.2.1 -> 1.2.0.192)
        const reversedIp = ip.split(".").reverse().join(".");
        const { stdout } = await execAsync(
          `dig +short ${reversedIp}.${bl.host}`
        );
        const listed = stdout.trim().length > 0 && stdout.trim() !== "127.0.0.1";
        return { name: bl.name, listed };
      } catch (error) {
        // DNSBL query failed, assume not listed
        return { name: bl.name, listed: false };
      }
    })
  );

  const blacklisted = results.some((r) => r.listed);
  const blacklistNames = results.filter((r) => r.listed).map((r) => r.name);

  return {
    blacklisted,
    blacklists: blacklistNames,
    details: results,
  };
};

/**
 * Calculate sender score (0-100)
 */
export const calculateSenderScore = (metrics: {
  bounceRate: number;
  complaintRate: number;
  deliveryRate: number;
  blacklisted: boolean;
}): number => {
  let score = 100;

  // Deduct for bounce rate (max -50 points)
  if (metrics.bounceRate > 0.05) {
    // >5% bounce rate
    score -= 50;
  } else if (metrics.bounceRate > 0.02) {
    // >2% bounce rate
    score -= 30;
  } else if (metrics.bounceRate > 0.01) {
    // >1% bounce rate
    score -= 15;
  } else if (metrics.bounceRate > 0.005) {
    // >0.5% bounce rate
    score -= 5;
  }

  // Deduct for complaint rate (max -30 points)
  if (metrics.complaintRate > 0.001) {
    // >0.1% complaint rate
    score -= 30;
  } else if (metrics.complaintRate > 0.0005) {
    // >0.05% complaint rate
    score -= 20;
  } else if (metrics.complaintRate > 0.0001) {
    // >0.01% complaint rate
    score -= 10;
  }

  // Deduct for delivery rate (max -20 points)
  if (metrics.deliveryRate < 0.95) {
    // <95% delivery rate
    score -= 20;
  } else if (metrics.deliveryRate < 0.98) {
    // <98% delivery rate
    score -= 10;
  }

  // Deduct for blacklist (max -50 points)
  if (metrics.blacklisted) {
    score -= 50;
  }

  return Math.max(0, Math.min(100, score));
};

/**
 * Get or create reputation metrics for a domain
 */
export const getReputationMetrics = async (
  emailDomainId: string,
  date: Date = new Date()
): Promise<EmailReputationMetric> => {
  const dateStr = date.toISOString().split("T")[0];

  let metrics = await db.query.emailReputationMetrics.findFirst({
    where: and(
      eq(emailReputationMetrics.emailDomainId, emailDomainId),
      eq(emailReputationMetrics.metricDate, dateStr)
    ),
  });

  if (!metrics) {
    // Create new metrics record
    metrics = await db
      .insert(emailReputationMetrics)
      .values({
        emailDomainId,
        metricDate: dateStr,
        totalSent: 0,
        totalDelivered: 0,
        totalBounced: 0,
        totalComplained: 0,
        bounceRate: 0,
        complaintRate: 0,
        deliveryRate: 0,
        senderScore: null,
        blacklistStatus: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning()
      .then((value) => value[0]);

    if (!metrics) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create reputation metrics",
      });
    }
  }

  return metrics;
};

/**
 * Update reputation metrics for a domain
 */
export const updateReputationMetrics = async (
  emailDomainId: string,
  date: Date = new Date()
): Promise<EmailReputationMetric> => {
  const metrics = await getReputationMetrics(emailDomainId, date);

  // Get domain to check IP
  const domain = await db.query.emailDomains.findFirst({
    where: (emailDomains: any, { eq }: any) =>
      eq(emailDomains.emailDomainId, emailDomainId),
  });

  // Calculate rates (stored as integers 0-10000)
  const bounceRate =
    metrics.totalSent > 0
      ? Math.round((metrics.totalBounced / metrics.totalSent) * 10000)
      : 0;
  const complaintRate =
    metrics.totalSent > 0
      ? Math.round((metrics.totalComplained / metrics.totalSent) * 10000)
      : 0;
  const deliveryRate =
    metrics.totalSent > 0
      ? Math.round((metrics.totalDelivered / metrics.totalSent) * 10000)
      : 0;

  // Get blacklist status if IP is available
  let blacklistStatus = null;
  let blacklisted = false;

  if (domain?.mailServerIp) {
    try {
      const blacklistCheck = await checkIPBlacklist(domain.mailServerIp);
      blacklisted = blacklistCheck.blacklisted;
      blacklistStatus = JSON.stringify(blacklistCheck);
    } catch (error) {
      // If blacklist check fails, continue without it
      console.error("Failed to check IP blacklist:", error);
    }
  }

  // Calculate sender score
  const senderScore = calculateSenderScore({
    bounceRate: bounceRate / 10000,
    complaintRate: complaintRate / 10000,
    deliveryRate: deliveryRate / 10000,
    blacklisted,
  });

  const updated = await db
    .update(emailReputationMetrics)
    .set({
      bounceRate,
      complaintRate,
      deliveryRate,
      senderScore,
      blacklistStatus,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(emailReputationMetrics.metricId, metrics.metricId))
    .returning()
    .then((value) => value[0]);

  if (!updated) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to update reputation metrics",
    });
  }

  return updated;
};

/**
 * Get reputation summary for a domain
 */
export const getReputationSummary = async (emailDomainId: string) => {
  const today = new Date();
  const metrics = await getReputationMetrics(emailDomainId, today);

  // Get blacklist status if IP is available
  // This requires domain lookup - will be done in API layer

  return {
    senderScore: metrics.senderScore || 0,
    bounceRate: metrics.bounceRate / 10000,
    complaintRate: metrics.complaintRate / 10000,
    deliveryRate: metrics.deliveryRate / 10000,
    totalSent: metrics.totalSent,
    totalDelivered: metrics.totalDelivered,
    totalBounced: metrics.totalBounced,
    totalComplained: metrics.totalComplained,
    blacklistStatus: metrics.blacklistStatus
      ? JSON.parse(metrics.blacklistStatus)
      : null,
  };
};

/**
 * Increment sent count for a domain
 */
export const incrementSentCount = async (
  emailDomainId: string,
  amount: number = 1
): Promise<void> => {
  const metrics = await getReputationMetrics(emailDomainId);
  await db
    .update(emailReputationMetrics)
    .set({
      totalSent: metrics.totalSent + amount,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(emailReputationMetrics.metricId, metrics.metricId));
  
  // Recalculate rates
  await updateReputationMetrics(emailDomainId);
};

/**
 * Increment delivered count for a domain
 */
export const incrementDeliveredCount = async (
  emailDomainId: string,
  amount: number = 1
): Promise<void> => {
  const metrics = await getReputationMetrics(emailDomainId);
  await db
    .update(emailReputationMetrics)
    .set({
      totalDelivered: metrics.totalDelivered + amount,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(emailReputationMetrics.metricId, metrics.metricId));
  
  // Recalculate rates
  await updateReputationMetrics(emailDomainId);
};

/**
 * Alert if reputation is poor
 */
export const checkReputationThresholds = async (emailDomainId: string): Promise<{
  poor: boolean;
  issues: string[];
  senderScore: number;
}> => {
  const summary = await getReputationSummary(emailDomainId);
  const issues: string[] = [];

  if (summary.senderScore < 50) {
    issues.push(`Low sender score: ${summary.senderScore}/100`);
  }

  if (summary.bounceRate > 0.05) {
    issues.push(`High bounce rate: ${(summary.bounceRate * 100).toFixed(2)}%`);
  }

  if (summary.complaintRate > 0.001) {
    issues.push(
      `High complaint rate: ${(summary.complaintRate * 100).toFixed(3)}%`
    );
  }

  if (summary.deliveryRate < 0.95) {
    issues.push(
      `Low delivery rate: ${(summary.deliveryRate * 100).toFixed(2)}%`
    );
  }

  if (summary.blacklistStatus?.blacklisted) {
    issues.push(
      `IP blacklisted: ${summary.blacklistStatus.blacklists.join(", ")}`
    );
  }

  return {
    poor: issues.length > 0,
    issues,
    senderScore: summary.senderScore,
  };
};

