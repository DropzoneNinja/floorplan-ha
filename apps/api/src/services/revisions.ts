import { prisma } from "../lib/prisma.js";

type RevisionAction = "create" | "update" | "delete";

/**
 * Record a create/update/delete event in the revision history table.
 * Non-blocking: errors are logged but not propagated to callers.
 */
export async function recordRevision(
  entityType: string,
  entityId: string,
  action: RevisionAction,
  before: unknown,
  after: unknown,
  userId?: string,
): Promise<void> {
  try {
    await prisma.revisionHistory.create({
      data: {
        entityType,
        entityId,
        action,
        beforeJson: before ?? undefined,
        afterJson: after ?? undefined,
        userId: userId ?? null,
      },
    });
  } catch (err) {
    // Revision recording failures should not break main operations
    console.error("[revisions] Failed to record revision:", err);
  }
}
