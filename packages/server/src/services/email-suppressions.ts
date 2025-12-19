import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { emailSuppressions } from "../db/schema";

export type EmailSuppression = typeof emailSuppressions.$inferSelect;

/**
 * Check if an email address is on the suppression list
 */
export const checkSuppressionList = async (
  emailDomainId: string,
  emailAddress: string
): Promise<boolean> => {
  const suppression = await db.query.emailSuppressions.findFirst({
    where: and(
      eq(emailSuppressions.emailDomainId, emailDomainId),
      eq(emailSuppressions.emailAddress, emailAddress.toLowerCase().trim())
    ),
  });

  return !!suppression;
};

/**
 * Add email address to suppression list
 */
export const addToSuppressionList = async (input: {
  emailDomainId: string;
  emailAddress: string;
  suppressionType: "bounce" | "complaint" | "unsubscribe" | "manual";
  reason?: string;
}): Promise<EmailSuppression> => {
  // Check if already suppressed
  const existing = await checkSuppressionList(
    input.emailDomainId,
    input.emailAddress
  );

  if (existing) {
    // Update existing suppression
    const updated = await db
      .update(emailSuppressions)
      .set({
        suppressionType: input.suppressionType,
        reason: input.reason,
        suppressedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(emailSuppressions.emailDomainId, input.emailDomainId),
          eq(emailSuppressions.emailAddress, input.emailAddress.toLowerCase().trim())
        )
      )
      .returning()
      .then((value) => value[0]);

    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update suppression",
      });
    }

    return updated;
  }

  // Create new suppression
  const newSuppression = await db
    .insert(emailSuppressions)
    .values({
      emailDomainId: input.emailDomainId,
      emailAddress: input.emailAddress.toLowerCase().trim(),
      suppressionType: input.suppressionType,
      reason: input.reason,
      suppressedAt: new Date().toISOString(),
    })
    .returning()
    .then((value) => value[0]);

  if (!newSuppression) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to add to suppression list",
    });
  }

  return newSuppression;
};

/**
 * Remove email address from suppression list
 */
export const removeFromSuppressionList = async (
  emailDomainId: string,
  emailAddress: string
): Promise<void> => {
  const result = await db
    .delete(emailSuppressions)
    .where(
      and(
        eq(emailSuppressions.emailDomainId, emailDomainId),
        eq(emailSuppressions.emailAddress, emailAddress.toLowerCase().trim())
      )
    )
    .returning();

  if (result.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Suppression not found",
    });
  }
};

/**
 * Get all suppressions for a domain
 */
export const getSuppressionsByDomainId = async (emailDomainId: string) => {
  return await db.query.emailSuppressions.findMany({
    where: eq(emailSuppressions.emailDomainId, emailDomainId),
    orderBy: (emailSuppressions: any, { desc }: any) => [
      desc(emailSuppressions.suppressedAt),
    ],
  });
};

