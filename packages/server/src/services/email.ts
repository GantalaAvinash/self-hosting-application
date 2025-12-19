import { TRPCError } from "@trpc/server";
import * as bcrypt from "bcrypt";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  emailAccounts,
  emailAliases,
  emailDomains,
  emailForwards,
} from "../db/schema";
import { execAsync } from "../utils/process/execAsync";

export type EmailDomain = typeof emailDomains.$inferSelect;
export type EmailAccount = typeof emailAccounts.$inferSelect;
export type EmailForward = typeof emailForwards.$inferSelect;
export type EmailAlias = typeof emailAliases.$inferSelect;

// ==================== Email Domain Services ====================

export const createEmailDomain = async (
  input: {
    domain: string;
    projectId: string;
    serverId?: string;
    enableCatchAll?: boolean;
    catchAllAddress?: string;
    description?: string;
  },
  organizationId: string
) => {
  const newDomain = await db
    .insert(emailDomains)
    .values({
      ...input,
      organizationId,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .then((value: EmailDomain[]) => value[0]);

  if (!newDomain) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Error creating email domain",
    });
  }

  // Generate DKIM keys
  await generateDKIMKeys(newDomain.emailDomainId);

  return newDomain;
};

export const findEmailDomainById = async (emailDomainId: string) => {
  const domain = await db.query.emailDomains.findFirst({
    where: eq(emailDomains.emailDomainId, emailDomainId),
    with: {
      project: true,
      server: true,
      accounts: true,
      forwards: true,
      aliases: true,
    },
  });

  if (!domain) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Email domain not found",
    });
  }

  return domain;
};

export const findEmailDomainsByProjectId = async (projectId: string) => {
  return await db.query.emailDomains.findMany({
    where: eq(emailDomains.projectId, projectId),
    with: {
      accounts: true,
      forwards: true,
      aliases: true,
    },
    orderBy: (emailDomains: any, { desc }: any) => [
      desc(emailDomains.createdAt),
    ],
  });
};

export const findEmailDomainsByOrganizationId = async (
  organizationId: string
) => {
  return await db.query.emailDomains.findMany({
    where: eq(emailDomains.organizationId, organizationId),
    with: {
      project: true,
      accounts: true,
    },
    orderBy: (emailDomains: any, { desc }: any) => [
      desc(emailDomains.createdAt),
    ],
  });
};

export const updateEmailDomain = async (
  emailDomainId: string,
  input: Partial<{
    status?: "pending" | "active" | "suspended" | "failed";
    enableCatchAll?: boolean;
    catchAllAddress?: string;
    spfRecord?: string;
    dmarcRecord?: string;
    description?: string;
    dnsVerified?: boolean;
  }>
) => {
  const updatedDomain = await db
    .update(emailDomains)
    .set(input)
    .where(eq(emailDomains.emailDomainId, emailDomainId))
    .returning()
    .then((value: EmailDomain[]) => value[0]);

  if (!updatedDomain) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Error updating email domain",
    });
  }

  return updatedDomain;
};

export const removeEmailDomain = async (emailDomainId: string) => {
  const result = await db
    .delete(emailDomains)
    .where(eq(emailDomains.emailDomainId, emailDomainId))
    .returning();

  if (result.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Email domain not found",
    });
  }

  return result[0];
};

// ==================== Email Account Services ====================

export const createEmailAccount = async (input: {
  username: string;
  emailDomainId: string;
  password: string;
  fullName?: string;
  quota?: number;
  enabled?: boolean;
}) => {
  const domain = await findEmailDomainById(input.emailDomainId);

  // Enforce DNS verification before account creation
  if (!domain.dnsVerified) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "DNS records must be verified before creating email accounts. Please verify DNS records first.",
    });
  }

  const email = `${input.username}@${domain.domain}`;

  // Check if username already exists for this domain
  const existing = await db.query.emailAccounts.findFirst({
    where: and(
      eq(emailAccounts.emailDomainId, input.emailDomainId),
      eq(emailAccounts.username, input.username)
    ),
  });

  if (existing) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Email account already exists",
    });
  }

  // Validate quota
  if (input.quota && input.quota > 102400) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Quota cannot exceed 100GB (102400 MB)",
    });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(input.password, 10);

  // Use transaction to ensure atomicity
  return await db.transaction(async (tx) => {
    const newAccount = await tx
      .insert(emailAccounts)
      .values({
        username: input.username,
        passwordHash,
        fullName: input.fullName,
        quota: input.quota || 1024,
        enabled: input.enabled ?? true,
        emailDomainId: input.emailDomainId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning()
      .then((value: EmailAccount[]) => value[0]);

    if (!newAccount) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Error creating email account",
      });
    }

    // Create mailbox in mail server with plaintext password
    // If this fails, the transaction will rollback
    try {
      await createMailboxInServer(
        newAccount,
        domain as EmailDomain,
        input.password
      );
    } catch (error) {
      // Transaction will automatically rollback
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to create mailbox in mail server: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    return newAccount;
  });
};

export const findEmailAccountById = async (emailAccountId: string) => {
  const account = await db.query.emailAccounts.findFirst({
    where: eq(emailAccounts.emailAccountId, emailAccountId),
    with: {
      emailDomain: true,
      aliases: true,
    },
  });

  if (!account) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Email account not found",
    });
  }

  return account;
};

export const findEmailAccountsByDomainId = async (emailDomainId: string) => {
  return await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.emailDomainId, emailDomainId),
    with: {
      aliases: true,
    },
    orderBy: (emailAccounts: any, { desc }: any) => [
      desc(emailAccounts.createdAt),
    ],
  });
};

export const updateEmailAccount = async (
  emailAccountId: string,
  input: Partial<{
    password?: string;
    fullName?: string;
    quota?: number;
    enabled?: boolean;
    imapEnabled?: boolean;
    pop3Enabled?: boolean;
    smtpEnabled?: boolean;
  }>
) => {
  const updateData: any = { ...input };

  // Validate quota
  if (input.quota !== undefined) {
    if (input.quota < 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Quota cannot be negative",
      });
    }
    if (input.quota > 102400) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Quota cannot exceed 100GB (102400 MB)",
      });
    }
  }

  // Hash new password if provided
  if (input.password) {
    updateData.passwordHash = await bcrypt.hash(input.password, 10);
    delete updateData.password;
  }

  // Use transaction to ensure atomicity
  return await db.transaction(async (tx) => {
    const updatedAccount = await tx
      .update(emailAccounts)
      .set(updateData)
      .where(eq(emailAccounts.emailAccountId, emailAccountId))
      .returning()
      .then((value: EmailAccount[]) => value[0]);

    if (!updatedAccount) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Error updating email account",
      });
    }

    // Update mailbox in server if password changed
    if (input.password) {
      try {
        await updateMailboxPassword(updatedAccount, input.password);
      } catch (error) {
        // Transaction will automatically rollback
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update mailbox password: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }

    return updatedAccount;
  });
};

export const removeEmailAccount = async (emailAccountId: string) => {
  const account = await findEmailAccountById(emailAccountId);

  const result = await db
    .delete(emailAccounts)
    .where(eq(emailAccounts.emailAccountId, emailAccountId))
    .returning();

  if (result.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Email account not found",
    });
  }

  // Remove mailbox from server
  await removeMailboxFromServer(account as EmailAccount);

  return result[0];
};

// ==================== Email Forward Services ====================

export const createEmailForward = async (input: {
  sourceAddress: string;
  destinationAddress: string;
  emailDomainId: string;
}) => {
  const newForward = await db
    .insert(emailForwards)
    .values({
      ...input,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .then((value: EmailForward[]) => value[0]);

  if (!newForward) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Error creating email forward",
    });
  }

  // Update mail server configuration
  await updateMailServerForwards(input.emailDomainId);

  return newForward;
};

export const findEmailForwardById = async (emailForwardId: string) => {
  const forward = await db.query.emailForwards.findFirst({
    where: eq(emailForwards.emailForwardId, emailForwardId),
    with: {
      emailDomain: true,
    },
  });

  if (!forward) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Email forward not found",
    });
  }

  return forward;
};

export const findEmailForwardsByDomainId = async (emailDomainId: string) => {
  return await db.query.emailForwards.findMany({
    where: eq(emailForwards.emailDomainId, emailDomainId),
    orderBy: (table: any, { desc }: any) => [desc(table.createdAt)],
  });
};

export const updateEmailForward = async (
  emailForwardId: string,
  input: Partial<{
    destinationAddress?: string;
    enabled?: boolean;
  }>
) => {
  const updatedForward = await db
    .update(emailForwards)
    .set(input)
    .where(eq(emailForwards.emailForwardId, emailForwardId))
    .returning()
    .then((value: EmailForward[]) => value[0]);

  if (!updatedForward) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Error updating email forward",
    });
  }

  // Update mail server configuration
  await updateMailServerForwards(updatedForward.emailDomainId);

  return updatedForward;
};

export const removeEmailForward = async (emailForwardId: string) => {
  const forward = await findEmailForwardById(emailForwardId);

  const result = await db
    .delete(emailForwards)
    .where(eq(emailForwards.emailForwardId, emailForwardId))
    .returning();

  if (result.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Email forward not found",
    });
  }

  // Update mail server configuration
  await updateMailServerForwards(forward.emailDomainId);

  return result[0];
};

// ==================== Email Alias Services ====================

export const createEmailAlias = async (input: {
  aliasAddress: string;
  destinationAddress: string;
  emailDomainId: string;
}) => {
  // Lookup the email account by username and domain
  const account = await db.query.emailAccounts.findFirst({
    where: and(
      eq(emailAccounts.username, input.destinationAddress),
      eq(emailAccounts.emailDomainId, input.emailDomainId)
    ),
  });

  if (!account) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Email account '${input.destinationAddress}' not found in this domain`,
    });
  }

  const newAlias = await db
    .insert(emailAliases)
    .values({
      aliasAddress: input.aliasAddress,
      emailAccountId: account.emailAccountId,
      emailDomainId: input.emailDomainId,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .then((value: EmailAlias[]) => value[0]);

  if (!newAlias) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Error creating email alias",
    });
  }

  // Update mail server configuration
  await updateMailServerAliases(input.emailDomainId);

  return newAlias;
};

export const findEmailAliasById = async (emailAliasId: string) => {
  const alias = await db.query.emailAliases.findFirst({
    where: eq(emailAliases.emailAliasId, emailAliasId),
    with: {
      emailAccount: true,
      emailDomain: true,
    },
  });

  if (!alias) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Email alias not found",
    });
  }

  return alias;
};

export const findEmailAliasesByDomainId = async (emailDomainId: string) => {
  return await db.query.emailAliases.findMany({
    where: eq(emailAliases.emailDomainId, emailDomainId),
    with: {
      emailAccount: true,
    },
    orderBy: (emailAliases: any, { desc }: any) => [
      desc(emailAliases.createdAt),
    ],
  });
};

export const findEmailAliasesByAccountId = async (emailAccountId: string) => {
  return await db.query.emailAliases.findMany({
    where: eq(emailAliases.emailAccountId, emailAccountId),
    orderBy: (table: any, { desc }: any) => [desc(table.createdAt)],
  });
};

export const updateEmailAlias = async (
  emailAliasId: string,
  input: Partial<{
    enabled?: boolean;
  }>
) => {
  const updatedAlias = await db
    .update(emailAliases)
    .set(input)
    .where(eq(emailAliases.emailAliasId, emailAliasId))
    .returning()
    .then((value: EmailAlias[]) => value[0]);

  if (!updatedAlias) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Error updating email alias",
    });
  }

  // Update mail server configuration
  await updateMailServerAliases(updatedAlias.emailDomainId);

  return updatedAlias;
};

export const removeEmailAlias = async (emailAliasId: string) => {
  const alias = await findEmailAliasById(emailAliasId);

  const result = await db
    .delete(emailAliases)
    .where(eq(emailAliases.emailAliasId, emailAliasId))
    .returning();

  if (result.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Email alias not found",
    });
  }

  // Update mail server configuration
  await updateMailServerAliases(alias.emailDomainId);

  return result[0];
};

// ==================== DKIM & DNS Services ====================

export const generateDKIMKeys = async (emailDomainId: string) => {
  const domain = await findEmailDomainById(emailDomainId);

  try {
    // Use mail server's DKIM generation
    await mailServer.generateDkimKeys(domain.domain);

    // Get the public key from mail server
    const selector = domain.dkimSelector || "mail";
    const dkimRecord = await mailServer.getDkimPublicKey(domain.domain, selector);

    // Parse the DKIM record to extract public key
    // Format: "v=DKIM1; k=rsa; p=..."
    const publicKeyMatch = dkimRecord.match(/p=([^;]+)/);
    const publicKey = publicKeyMatch ? publicKeyMatch[1].trim() : "";

    // Update domain with keys
    await db
      .update(emailDomains)
      .set({
        dkimPublicKey: publicKey,
        dkimSelector: selector,
      })
      .where(eq(emailDomains.emailDomainId, emailDomainId));

    // Generate DNS records with strict policies
    const mailServerIp = domain.mailServerIp || "";
    const mailHost = `mail.${domain.domain}`;
    
    // Build strict SPF record
    const spfParts = ["v=spf1", "mx", `a:${mailHost}`];
    if (mailServerIp) {
      spfParts.push(`ip4:${mailServerIp}`);
    }
    spfParts.push("-all"); // Strict: -all instead of ~all
    const spfRecord = spfParts.join(" ");
    
    // Build DMARC record with reporting
    const dmarcRecord = `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain.domain}; ruf=mailto:dmarc@${domain.domain}; pct=100; sp=quarantine; aspf=r; adkim=r`;

    return {
      publicKey,
      dkimRecord: dkimRecord,
      spfRecord,
      dmarcRecord,
    };
  } catch (error) {
    console.error("Error generating DKIM keys:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to generate DKIM keys: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
};

export const verifyDNSRecords = async (emailDomainId: string) => {
  const domain = await findEmailDomainById(emailDomainId);

  try {
    // Verify MX records - dig returns: "10 mail.example.com."
    let mxVerified = false;
    try {
      const { stdout: mxOutput } = await execAsync(
        `dig +short MX ${domain.domain}`
      );
      const mxLines = mxOutput.trim().split("\n").filter((line) => line.trim());
      // Check if any MX record points to mail server
      const mailHost = domain.mailServerIp
        ? domain.mailServerIp
        : `mail.${domain.domain}`;
      mxVerified = mxLines.some((line) =>
        line.toLowerCase().includes(mailHost.toLowerCase())
      );
    } catch (error) {
      console.error("MX verification error:", error);
    }

    // Verify SPF record - dig returns: "v=spf1 mx ~all"
    let spfVerified = false;
    try {
      const { stdout: spfOutput } = await execAsync(
        `dig +short TXT ${domain.domain}`
      );
      const spfLines = spfOutput
        .trim()
        .split("\n")
        .filter((line) => line.includes("v=spf1"));
      spfVerified = spfLines.length > 0;
    } catch (error) {
      console.error("SPF verification error:", error);
    }

    // Verify DKIM record
    let dkimVerified = false;
    if (domain.dkimSelector) {
      try {
        const { stdout: dkimOutput } = await execAsync(
          `dig +short TXT ${domain.dkimSelector}._domainkey.${domain.domain}`
        );
        dkimVerified = dkimOutput.trim().length > 0;
      } catch (error) {
        console.error("DKIM verification error:", error);
      }
    }

    // Verify DMARC record
    let dmarcVerified = false;
    try {
      const { stdout: dmarcOutput } = await execAsync(
        `dig +short TXT _dmarc.${domain.domain}`
      );
      const dmarcLines = dmarcOutput
        .trim()
        .split("\n")
        .filter((line) => line.includes("v=DMARC1"));
      dmarcVerified = dmarcLines.length > 0;
    } catch (error) {
      console.error("DMARC verification error:", error);
    }

    const verified = {
      mx: mxVerified,
      spf: spfVerified,
      dkim: dkimVerified,
      dmarc: dmarcVerified,
    };

    // Update domain status if all verified
    if (verified.mx && verified.spf && verified.dkim && verified.dmarc) {
      await updateEmailDomain(emailDomainId, {
        status: "active",
        dnsVerified: true,
      });
    } else {
      // Mark as not verified if checks fail
      await updateEmailDomain(emailDomainId, {
        dnsVerified: false,
      });
    }

    return verified;
  } catch (error) {
    console.error("Error verifying DNS records:", error);
    // Mark as not verified on error
    await updateEmailDomain(emailDomainId, {
      dnsVerified: false,
    });
    return {
      mx: false,
      spf: false,
      dkim: false,
      dmarc: false,
    };
  }
};

export const getDNSRecords = async (emailDomainId: string) => {
  const domain = await findEmailDomainById(emailDomainId);

  // Get mail server IP (use domain's mailServerIp or default to mail subdomain)
  const mailServerIp = domain.mailServerIp || "";
  const mailHost = `mail.${domain.domain}`;

  // Build strict SPF record with explicit IP
  const spfParts = ["v=spf1", "mx", `a:${mailHost}`];
  if (mailServerIp) {
    spfParts.push(`ip4:${mailServerIp}`);
  }
  spfParts.push("-all"); // Strict: -all instead of ~all

  const spfRecord = spfParts.join(" ");

  // Build DMARC record with reporting
  const dmarcRecord = domain.dmarcRecord ||
    `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain.domain}; ruf=mailto:dmarc@${domain.domain}; pct=100; sp=quarantine; aspf=r; adkim=r`;

  return {
    mx: {
      type: "MX",
      host: "@",
      value: `${domain.mxPriority} ${mailHost}`,
      priority: domain.mxPriority,
    },
    spf: {
      type: "TXT",
      host: "@",
      value: spfRecord,
    },
    dkim: {
      type: "TXT",
      host: `${domain.dkimSelector || "mail"}._domainkey`,
      value: `v=DKIM1; k=rsa; p=${domain.dkimPublicKey || ""}`,
    },
    dmarc: {
      type: "TXT",
      host: "_dmarc",
      value: dmarcRecord,
    },
  };
};

// ==================== Mail Server Integration ====================
import * as mailServer from "../utils/mail-server";

const createMailboxInServer = async (
  account: EmailAccount,
  domain: EmailDomain,
  password: string
) => {
  // Check mail server health before operation
  const health = await mailServer.checkMailServerHealth();
  if (!health.running) {
    throw new Error(
      "Mail server is not running. Please start the mail server first."
    );
  }
  if (!health.healthy) {
    throw new Error(
      `Mail server is not healthy: ${health.message}. Please check the mail server status.`
    );
  }

  const email = `${account.username}@${domain.domain}`;

  // Create mailbox with plaintext password
  await mailServer.createMailbox(email, password);

  // Set quota if specified
  if (account.quota) {
    await mailServer.setMailboxQuota(email, account.quota);
  }
};

const updateMailboxPassword = async (
  account: EmailAccount,
  newPassword: string
) => {
  // Check mail server health before operation
  const health = await mailServer.checkMailServerHealth();
  if (!health.running) {
    throw new Error(
      "Mail server is not running. Please start the mail server first."
    );
  }

  const domain = await db.query.emailDomains.findFirst({
    where: eq(emailDomains.emailDomainId, account.emailDomainId),
  });

  if (!domain) {
    throw new Error("Domain not found");
  }

  const email = `${account.username}@${domain.domain}`;
  await mailServer.updateMailboxPassword(email, newPassword);
};

const removeMailboxFromServer = async (account: EmailAccount) => {
  // Check mail server health before operation
  const health = await mailServer.checkMailServerHealth();
  if (!health.running) {
    // If server is down, we can still proceed with DB deletion
    // but log a warning
    console.warn(
      "Mail server is not running. Mailbox deletion from server will be skipped."
    );
    return;
  }

  const domain = await db.query.emailDomains.findFirst({
    where: eq(emailDomains.emailDomainId, account.emailDomainId),
  });

  if (!domain) {
    throw new Error("Domain not found");
  }

  const email = `${account.username}@${domain.domain}`;
  await mailServer.removeMailbox(email);
};

const updateMailServerForwards = async (emailDomainId: string) => {
  try {
    const domain = await db.query.emailDomains.findFirst({
      where: eq(emailDomains.emailDomainId, emailDomainId),
    });

    if (!domain) {
      return;
    }

    const forwards = await db.query.emailForwards.findMany({
      where: eq(emailForwards.emailDomainId, emailDomainId),
    });

    // Update Postfix virtual alias map with all forwards
    for (const forward of forwards) {
      const sourceEmail = `${forward.sourceAddress}@${domain.domain}`;
      await mailServer.configureForwarding(
        sourceEmail,
        forward.destinationAddress
      );
    }
  } catch (error) {
    console.error("Error updating mail server forwards:", error);
  }
};

const updateMailServerAliases = async (emailDomainId: string) => {
  try {
    const domain = await db.query.emailDomains.findFirst({
      where: eq(emailDomains.emailDomainId, emailDomainId),
    });

    if (!domain) {
      return;
    }

    const aliases = await db.query.emailAliases.findMany({
      where: eq(emailAliases.emailDomainId, emailDomainId),
      with: {
        emailAccount: true,
      },
    });

    // Update aliases in mail server
    for (const alias of aliases) {
      if (!alias.emailAccount) continue;

      const aliasEmail = `${alias.aliasAddress}@${domain.domain}`;
      const destinationEmail = `${(alias.emailAccount as any).username}@${
        domain.domain
      }`;
      await mailServer.addAlias(aliasEmail, destinationEmail);
    }
  } catch (error) {
    console.error("Error updating mail server aliases:", error);
  }
};

export const getEmailAccountConnectionInfo = (
  account: EmailAccount,
  domain: EmailDomain
) => {
  const serverAddress = domain.serverId ? `mail.${domain.domain}` : "localhost";

  return {
    incoming: {
      imap: {
        server: serverAddress,
        port: 993,
        security: "SSL/TLS",
        username: account.email,
      },
      pop3: {
        server: serverAddress,
        port: 995,
        security: "SSL/TLS",
        username: account.email,
      },
    },
    outgoing: {
      smtp: {
        server: serverAddress,
        port: 465,
        security: "SSL/TLS",
        username: account.email,
      },
    },
    webmail: `https://mail.${domain.domain}`,
  };
};
