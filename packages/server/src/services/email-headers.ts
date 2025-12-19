/**
 * Email Headers Compliance & Validation
 */

export interface EmailHeaders {
  From: string;
  To: string;
  Subject: string;
  "Message-ID"?: string;
  Date?: string;
  "MIME-Version"?: string;
  "List-Unsubscribe"?: string;
  "List-Unsubscribe-Post"?: string;
  "Precedence"?: string;
  "X-Mailer"?: string;
  "X-Auto-Response-Suppress"?: string;
  [key: string]: string | undefined;
}

/**
 * Required headers for email compliance
 */
const REQUIRED_HEADERS = [
  "From",
  "To",
  "Subject",
  "Message-ID",
  "Date",
  "MIME-Version",
] as const;

/**
 * Recommended headers for better deliverability
 */
const RECOMMENDED_HEADERS = [
  "List-Unsubscribe",
  "List-Unsubscribe-Post",
  "Precedence",
  "X-Mailer",
  "X-Auto-Response-Suppress",
] as const;

/**
 * Validate email headers for compliance
 */
export const validateEmailHeaders = (
  headers: Partial<EmailHeaders>
): { valid: boolean; errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required headers
  for (const header of REQUIRED_HEADERS) {
    if (!headers[header] || headers[header]?.trim().length === 0) {
      errors.push(`Missing required header: ${header}`);
    }
  }

  // Validate Message-ID format
  if (headers["Message-ID"]) {
    const messageId = headers["Message-ID"];
    if (!messageId.match(/^<.+@.+>$/)) {
      errors.push(
        `Invalid Message-ID format. Expected: <local@domain>, got: ${messageId}`
      );
    }
  }

  // Validate From format
  if (headers.From) {
    const fromRegex = /^(.+?)\s*<(.+?)>|^(.+?)$/;
    if (!fromRegex.test(headers.From)) {
      errors.push(`Invalid From format: ${headers.From}`);
    }
  }

  // Validate To format
  if (headers.To) {
    const toRegex = /^(.+?)\s*<(.+?)>|^(.+?)$/;
    if (!toRegex.test(headers.To)) {
      errors.push(`Invalid To format: ${headers.To}`);
    }
  }

  // Check recommended headers
  for (const header of RECOMMENDED_HEADERS) {
    if (!headers[header]) {
      warnings.push(`Missing recommended header: ${header}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Add compliance headers to email
 */
export const addComplianceHeaders = (
  headers: Partial<EmailHeaders>,
  domain: string
): EmailHeaders => {
  const compliantHeaders: EmailHeaders = {
    ...headers,
  };

  // Ensure required headers exist
  if (!compliantHeaders["Message-ID"]) {
    // Generate Message-ID
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    compliantHeaders["Message-ID"] = `<${timestamp}.${random}@${domain}>`;
  }

  if (!compliantHeaders.Date) {
    compliantHeaders.Date = new Date().toUTCString();
  }

  if (!compliantHeaders["MIME-Version"]) {
    compliantHeaders["MIME-Version"] = "1.0";
  }

  // Add recommended headers
  if (!compliantHeaders["List-Unsubscribe"]) {
    compliantHeaders["List-Unsubscribe"] = `<mailto:unsubscribe@${domain}>`;
  }

  if (!compliantHeaders["List-Unsubscribe-Post"]) {
    compliantHeaders["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  if (!compliantHeaders.Precedence) {
    compliantHeaders.Precedence = "bulk";
  }

  if (!compliantHeaders["X-Mailer"]) {
    compliantHeaders["X-Mailer"] = "Dokploy Email Server";
  }

  if (!compliantHeaders["X-Auto-Response-Suppress"]) {
    compliantHeaders["X-Auto-Response-Suppress"] = "All";
  }

  return compliantHeaders as EmailHeaders;
};

/**
 * Format headers for email sending
 */
export const formatHeadersForSending = (
  headers: EmailHeaders
): string => {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      // Encode header value if needed
      const encodedValue = value.includes("\n")
        ? value.split("\n").join("\r\n ")
        : value;
      lines.push(`${key}: ${encodedValue}`);
    }
  }

  return lines.join("\r\n");
};

