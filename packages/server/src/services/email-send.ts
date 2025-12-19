import { TRPCError } from "@trpc/server";
import { db } from "../db";
import { emailSendingLog } from "../db/schema";
import { checkSuppressionList } from "./email-suppressions";
import { checkRateLimit, incrementRateLimit } from "./email-rate-limit";
import { processBounce } from "./email-bounces";
import { addComplianceHeaders, validateEmailHeaders } from "./email-headers";
import {
  incrementSentCount,
  incrementDeliveredCount,
} from "./email-reputation";

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Send email with retry logic and exponential backoff
 */
export const sendEmailWithRetry = async (input: {
  emailDomainId: string;
  emailAccountId?: string;
  recipientEmail: string;
  subject: string;
  body: string;
  headers?: Record<string, string>;
  maxRetries?: number;
}): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  const {
    emailDomainId,
    emailAccountId,
    recipientEmail,
    subject,
    body,
    headers = {},
    maxRetries = 3,
  } = input;

  // 1. Check suppression list
  const isSuppressed = await checkSuppressionList(
    emailDomainId,
    recipientEmail
  );

  if (isSuppressed) {
    // Log suppressed send attempt
    await logEmailSend({
      emailDomainId,
      emailAccountId,
      recipientEmail,
      status: "failed",
      statusMessage: "Email address is on suppression list",
    });

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Email address is on suppression list",
    });
  }

  // 2. Check rate limits
  await checkRateLimit(emailDomainId, emailAccountId, "daily");
  await checkRateLimit(emailDomainId, emailAccountId, "hourly");
  await checkRateLimit(emailDomainId, emailAccountId, "per_minute");

  // 3. Validate and add compliance headers
  const domain = await db.query.emailDomains.findFirst({
    where: (emailDomains: any, { eq }: any) =>
      eq(emailDomains.emailDomainId, emailDomainId),
  });

  if (!domain) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Email domain not found",
    });
  }

  const compliantHeaders = addComplianceHeaders(
    {
      From: headers.From || `noreply@${domain.domain}`,
      To: recipientEmail,
      Subject: subject,
      ...headers,
    },
    domain.domain
  );

  const validation = validateEmailHeaders(compliantHeaders);
  if (!validation.valid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid email headers: ${validation.errors.join(", ")}`,
    });
  }

  // 4. Attempt to send with retry logic
  let attempt = 0;
  let delay = 1000; // Start with 1 second
  let lastError: Error | null = null;
  const messageId = compliantHeaders["Message-ID"] || "";

  while (attempt < maxRetries) {
    try {
      // Log send attempt
      const logEntry = await logEmailSend({
        emailDomainId,
        emailAccountId,
        recipientEmail,
        messageId,
        status: "sent",
        statusMessage: `Attempt ${attempt + 1}/${maxRetries}`,
      });

      // TODO: Actually send email via mail server
      // For now, we'll simulate success
      // In production, this would call the mail server API

      // Increment rate limits
      await incrementRateLimit(emailDomainId, emailAccountId, "daily");
      await incrementRateLimit(emailDomainId, emailAccountId, "hourly");
      await incrementRateLimit(emailDomainId, emailAccountId, "per_minute");

      // Update reputation metrics (increment sent and delivered counts)
      await incrementSentCount(emailDomainId);
      await incrementDeliveredCount(emailDomainId);

      // Update log to delivered
      await updateEmailSendLog(logEntry.logId, {
        status: "delivered",
        deliveredAt: new Date().toISOString(),
      });

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      attempt++;
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt >= maxRetries) {
        // Permanent failure - log and throw
        await logEmailSend({
          emailDomainId,
          emailAccountId,
          recipientEmail,
          messageId,
          status: "failed",
          statusCode: "500",
          statusMessage: lastError.message,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send email after ${maxRetries} attempts: ${lastError.message}`,
        });
      }

      // Exponential backoff: 1s, 2s, 4s (max 30s)
      delay = Math.min(delay * 2, 30000);
      await sleep(delay);
    }
  }

  return {
    success: false,
    error: lastError?.message || "Unknown error",
  };
};

/**
 * Log email send attempt
 */
const logEmailSend = async (input: {
  emailDomainId: string;
  emailAccountId?: string;
  recipientEmail: string;
  messageId?: string;
  status: "sent" | "delivered" | "bounced" | "failed" | "deferred";
  statusCode?: string;
  statusMessage?: string;
}) => {
  const logEntry = await db
    .insert(emailSendingLog)
    .values({
      emailDomainId: input.emailDomainId,
      emailAccountId: input.emailAccountId || null,
      recipientEmail: input.recipientEmail.toLowerCase().trim(),
      messageId: input.messageId || null,
      status: input.status,
      statusCode: input.statusCode || null,
      statusMessage: input.statusMessage || null,
      sentAt: new Date().toISOString(),
    })
    .returning()
    .then((value) => value[0]);

  return logEntry;
};

/**
 * Update email send log
 */
const updateEmailSendLog = async (
  logId: string,
  updates: {
    status?: string;
    deliveredAt?: string;
    bouncedAt?: string;
    statusCode?: string;
    statusMessage?: string;
  }
) => {
  await db
    .update(emailSendingLog)
    .set(updates)
    .where((emailSendingLog: any, { eq }: any) =>
      eq(emailSendingLog.logId, logId)
    );
};

/**
 * Process bounce and update log
 */
export const processBounceAndUpdateLog = async (input: {
  emailDomainId: string;
  emailAccountId?: string;
  recipientEmail: string;
  bounceType: "hard" | "soft" | "transient";
  bounceCode?: string;
  bounceMessage?: string;
  messageId?: string;
}) => {
  // Process bounce
  await processBounce({
    emailDomainId: input.emailDomainId,
    emailAccountId: input.emailAccountId,
    recipientEmail: input.recipientEmail,
    bounceType: input.bounceType,
    bounceCode: input.bounceCode,
    bounceMessage: input.bounceMessage,
  });

  // Update sending log if messageId provided
  if (input.messageId) {
    const logEntry = await db.query.emailSendingLog.findFirst({
      where: (emailSendingLog: any, { eq }: any) =>
        eq(emailSendingLog.messageId, input.messageId),
    });

    if (logEntry) {
      await updateEmailSendLog(logEntry.logId, {
        status: "bounced",
        bouncedAt: new Date().toISOString(),
        statusCode: input.bounceCode,
        statusMessage: input.bounceMessage,
      });
    }
  }
};

