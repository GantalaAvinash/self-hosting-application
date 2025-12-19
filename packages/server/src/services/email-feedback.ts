import { db } from "../db";
import { emailDomains } from "../db/schema";
import { processComplaint } from "./email-complaints";
import { eq } from "drizzle-orm";

/**
 * Process ARF (Abuse Reporting Format) message from feedback loop
 * This handles complaints from major ISPs (Gmail, Outlook, etc.)
 */
export const processFeedbackLoop = async (arfMessage: string): Promise<{
  processed: boolean;
  complaintId?: string;
  error?: string;
}> => {
  try {
    // Parse ARF message
    // ARF format: https://tools.ietf.org/html/rfc5965
    const lines = arfMessage.split("\n");
    
    let inFeedbackReport = false;
    let feedbackReport: Record<string, string> = {};
    let originalMessage: Record<string, string> = {};
    let currentSection = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() || "";

      if (line.startsWith("Feedback-Type:")) {
        inFeedbackReport = true;
        currentSection = "feedback";
        feedbackReport.type = line.split(":")[1]?.trim() || "";
      } else if (line.startsWith("User-Agent:")) {
        feedbackReport.userAgent = line.split(":")[1]?.trim() || "";
      } else if (line.startsWith("Original-Mail-From:")) {
        currentSection = "original";
        originalMessage.from = line.split(":")[1]?.trim() || "";
      } else if (line.startsWith("Original-Rcpt-To:")) {
        originalMessage.to = line.split(":")[1]?.trim() || "";
      } else if (line.startsWith("Received-Date:")) {
        originalMessage.receivedDate = line.split(":")[1]?.trim() || "";
      } else if (line.startsWith("Message-ID:")) {
        originalMessage.messageId = line.split(":")[1]?.trim() || "";
      } else if (line.startsWith("---")) {
        // End of headers, start of body
        break;
      }
    }

    // Extract recipient email from Original-Rcpt-To
    const recipientEmail = originalMessage.to?.match(/<(.+?)>/) 
      ? originalMessage.to.match(/<(.+?)>/)?.[1] 
      : originalMessage.to;

    if (!recipientEmail) {
      return {
        processed: false,
        error: "Could not extract recipient email from ARF message",
      };
    }

    // Extract domain from recipient email
    const domainMatch = recipientEmail.match(/@(.+)$/);
    if (!domainMatch) {
      return {
        processed: false,
        error: "Could not extract domain from recipient email",
      };
    }

    // Find domain in database
    const domain = await db.query.emailDomains.findFirst({
      where: (emailDomains: any, { eq }: any) =>
        eq(emailDomains.domain, domainMatch[1]),
    });

    if (!domain) {
      return {
        processed: false,
        error: `Domain not found: ${domainMatch[1]}`,
      };
    }

    // Process complaint
    const complaint = await processComplaint({
      emailDomainId: domain.emailDomainId,
      recipientEmail,
      complaintSource: "feedback-loop",
      messageId: originalMessage.messageId,
      complaintDetails: {
        feedbackType: feedbackReport.type,
        userAgent: feedbackReport.userAgent,
        originalFrom: originalMessage.from,
        receivedDate: originalMessage.receivedDate,
      },
    });

    return {
      processed: true,
      complaintId: complaint.complaintId,
    };
  } catch (error) {
    console.error("Error processing feedback loop:", error);
    return {
      processed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Process manual abuse report
 */
export const processAbuseReport = async (input: {
  emailDomainId: string;
  recipientEmail: string;
  reportDetails: Record<string, any>;
}): Promise<{ complaintId: string }> => {
  const complaint = await processComplaint({
    emailDomainId: input.emailDomainId,
    recipientEmail: input.recipientEmail,
    complaintSource: "abuse-report",
    complaintDetails: input.reportDetails,
  });

  return {
    complaintId: complaint.complaintId,
  };
};

