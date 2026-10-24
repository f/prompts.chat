import { db } from "@/lib/db";

/** Slug of the default internal organization (created by the backfill migration). */
export const DEFAULT_ORG_SLUG = "internal";

/**
 * Resolve the organization an authenticated user acts within, server-side.
 * Client-supplied organization ids must never be trusted — they are only ever
 * compared against this value. Users that predate multi-tenancy (organizationId
 * still NULL) fall back to the default internal org.
 *
 * Returns null only if the user has no org AND the default org is missing,
 * which callers should treat as a 403.
 */
export async function resolveUserOrganizationId(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (user?.organizationId) {
    return user.organizationId;
  }
  const fallback = await db.organization.findUnique({
    where: { slug: DEFAULT_ORG_SLUG },
    select: { id: true },
  });
  return fallback?.id ?? null;
}
