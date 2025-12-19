import { MAILSERVER_CONTAINER } from "@dokploy/server/constants";
import { execAsync } from "@dokploy/server/utils/process/execAsync";
import { TRPCError } from "@trpc/server";

/**
 * Mail server Docker utilities
 * These functions interact with the docker-mailserver container
 */

/**
 * Check if mail server container is running
 */
export async function isMailServerRunning(): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `docker inspect -f '{{.State.Running}}' ${MAILSERVER_CONTAINER}`
    );
    return stdout.trim() === "true";
  } catch (error) {
    return false;
  }
}

/**
 * Create a new mailbox in the mail server
 * @param email Full email address (e.g., user@example.com)
 * @param password Plain text password
 */
export async function createMailbox(
  email: string,
  password: string
): Promise<void> {
  const isRunning = await isMailServerRunning();
  if (!isRunning) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Mail server is not running. Please start the mail server first.",
    });
  }

  try {
    await execAsync(
      `docker exec ${MAILSERVER_CONTAINER} setup email add ${email} "${password}"`
    );
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to create mailbox: ${error}`,
    });
  }
}

/**
 * Update mailbox password
 * @param email Full email address
 * @param newPassword New plain text password
 */
export async function updateMailboxPassword(
  email: string,
  newPassword: string
): Promise<void> {
  const isRunning = await isMailServerRunning();
  if (!isRunning) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Mail server is not running",
    });
  }

  try {
    await execAsync(
      `docker exec ${MAILSERVER_CONTAINER} setup email update ${email} "${newPassword}"`
    );
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to update mailbox password: ${error}`,
    });
  }
}

/**
 * Remove mailbox from mail server
 * @param email Full email address
 */
export async function removeMailbox(email: string): Promise<void> {
  const isRunning = await isMailServerRunning();
  if (!isRunning) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Mail server is not running",
    });
  }

  try {
    await execAsync(
      `docker exec ${MAILSERVER_CONTAINER} setup email del ${email}`
    );
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to remove mailbox: ${error}`,
    });
  }
}

/**
 * List all email accounts in mail server
 */
export async function listMailboxes(): Promise<string[]> {
  const isRunning = await isMailServerRunning();
  if (!isRunning) {
    return [];
  }

  try {
    const { stdout } = await execAsync(
      `docker exec ${MAILSERVER_CONTAINER} setup email list`
    );
    return stdout
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => line.trim());
  } catch (error) {
    return [];
  }
}

/**
 * Add email alias
 * @param alias Alias email address
 * @param destination Destination email address
 */
export async function addAlias(
  alias: string,
  destination: string
): Promise<void> {
  const isRunning = await isMailServerRunning();
  if (!isRunning) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Mail server is not running",
    });
  }

  try {
    await execAsync(
      `docker exec ${MAILSERVER_CONTAINER} setup alias add ${alias} ${destination}`
    );
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to add alias: ${error}`,
    });
  }
}

/**
 * Remove email alias
 * @param alias Alias email address
 * @param destination Destination email address
 */
export async function removeAlias(
  alias: string,
  destination: string
): Promise<void> {
  const isRunning = await isMailServerRunning();
  if (!isRunning) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Mail server is not running",
    });
  }

  try {
    await execAsync(
      `docker exec ${MAILSERVER_CONTAINER} setup alias del ${alias} ${destination}`
    );
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to remove alias: ${error}`,
    });
  }
}

/**
 * Generate DKIM keys for a domain
 * @param domain Domain name
 */
export async function generateDkimKeys(domain: string): Promise<void> {
  const isRunning = await isMailServerRunning();
  if (!isRunning) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Mail server is not running",
    });
  }

  try {
    await execAsync(
      `docker exec ${MAILSERVER_CONTAINER} setup config dkim domain ${domain}`
    );
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to generate DKIM keys: ${error}`,
    });
  }
}

/**
 * Get DKIM public key for a domain
 * @param domain Domain name
 * @param selector DKIM selector (default: mail)
 */
export async function getDkimPublicKey(
  domain: string,
  selector = "mail"
): Promise<string> {
  const isRunning = await isMailServerRunning();
  if (!isRunning) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Mail server is not running",
    });
  }

  try {
    const { stdout } = await execAsync(
      `docker exec ${MAILSERVER_CONTAINER} cat /tmp/docker-mailserver/opendkim/keys/${domain}/${selector}.txt`
    );
    return stdout.trim();
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to get DKIM public key: ${error}`,
    });
  }
}

/**
 * Restart mail server to apply changes
 */
export async function restartMailServer(): Promise<void> {
  try {
    await execAsync(`docker restart ${MAILSERVER_CONTAINER}`);
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to restart mail server: ${error}`,
    });
  }
}

/**
 * Get mail server logs
 * @param lines Number of lines to retrieve (default: 100)
 */
export async function getMailServerLogs(lines = 100): Promise<string> {
  const isRunning = await isMailServerRunning();
  if (!isRunning) {
    return "Mail server is not running";
  }

  try {
    const { stdout } = await execAsync(
      `docker logs ${MAILSERVER_CONTAINER} --tail ${lines}`
    );
    return stdout;
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to get mail server logs: ${error}`,
    });
  }
}

/**
 * Check mail server health
 */
export async function checkMailServerHealth(): Promise<{
  running: boolean;
  healthy: boolean;
  message: string;
}> {
  const isRunning = await isMailServerRunning();

  if (!isRunning) {
    return {
      running: false,
      healthy: false,
      message: "Mail server container is not running",
    };
  }

  try {
    const { stdout } = await execAsync(
      `docker inspect -f '{{.State.Health.Status}}' ${MAILSERVER_CONTAINER}`
    );
    const healthStatus = stdout.trim();

    return {
      running: true,
      healthy: healthStatus === "healthy",
      message:
        healthStatus === "healthy"
          ? "Mail server is healthy"
          : `Mail server health status: ${healthStatus}`,
    };
  } catch (error) {
    return {
      running: true,
      healthy: false,
      message:
        "Unable to check health status (container may not have healthcheck configured)",
    };
  }
}

/**
 * Configure email forwarding in Postfix
 * This updates the virtual alias map
 */
export async function configureForwarding(
  sourceEmail: string,
  destinationEmail: string
): Promise<void> {
  const isRunning = await isMailServerRunning();
  if (!isRunning) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Mail server is not running",
    });
  }

  try {
    // Add to virtual alias map
    await execAsync(
      `docker exec ${MAILSERVER_CONTAINER} sh -c 'echo "${sourceEmail} ${destinationEmail}" >> /tmp/docker-mailserver/postfix-virtual.cf'`
    );

    // Reload Postfix
    await execAsync(`docker exec ${MAILSERVER_CONTAINER} postfix reload`);
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to configure forwarding: ${error}`,
    });
  }
}

/**
 * Remove email forwarding
 */
export async function removeForwarding(sourceEmail: string): Promise<void> {
  const isRunning = await isMailServerRunning();
  if (!isRunning) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Mail server is not running",
    });
  }

  try {
    // Remove from virtual alias map
    await execAsync(
      `docker exec ${MAILSERVER_CONTAINER} sh -c 'sed -i "/${sourceEmail}/d" /tmp/docker-mailserver/postfix-virtual.cf'`
    );

    // Reload Postfix
    await execAsync(`docker exec ${MAILSERVER_CONTAINER} postfix reload`);
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to remove forwarding: ${error}`,
    });
  }
}

/**
 * Set mailbox quota
 * @param email Full email address
 * @param quotaMB Quota in megabytes (0 for unlimited)
 */
export async function setMailboxQuota(
  email: string,
  quotaMB: number
): Promise<void> {
  const isRunning = await isMailServerRunning();
  if (!isRunning) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Mail server is not running",
    });
  }

  try {
    await execAsync(
      `docker exec ${MAILSERVER_CONTAINER} setup quota set ${email} ${quotaMB}M`
    );
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to set mailbox quota: ${error}`,
    });
  }
}

/**
 * Get mailbox quota usage
 * @param email Full email address
 */
export async function getMailboxQuotaUsage(email: string): Promise<{
  used: number;
  limit: number;
  percentage: number;
}> {
  const isRunning = await isMailServerRunning();
  if (!isRunning) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Mail server is not running",
    });
  }

  try {
    const { stdout } = await execAsync(
      `docker exec ${MAILSERVER_CONTAINER} doveadm quota get -u ${email}`
    );

    // Parse doveadm output
    // Example output: "Quota name     Type    Value  Limit  %"
    const lines = stdout.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
      throw new Error("Invalid quota output");
    }

    const quotaLine = lines[1]?.trim().split(/\s+/);
    if (!quotaLine) {
      throw new Error("Invalid quota line");
    }
    const used = Number.parseInt(quotaLine[2] || "0", 10);
    const limit = Number.parseInt(quotaLine[3] || "0", 10);
    const percentage = Number.parseInt(quotaLine[4] || "0", 10);

    return { used, limit, percentage };
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to get mailbox quota: ${error}`,
    });
  }
}
