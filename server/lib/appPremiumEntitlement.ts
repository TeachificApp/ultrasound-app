import { eq } from "drizzle-orm";
import { brandMemberships } from "../../drizzle/schema";
import { getDb } from "../db";
import type { Brand } from "../../shared/brands";

export type AppMembershipSnapshot = {
  brand: string;
  tier: string;
  status: string;
  expiresAt: Date | string | null;
};

/**
 * Returns true only for a currently active paid membership. Expiry must be
 * enforced even when a subscription cancellation webhook has not yet updated
 * its membership row.
 */
export function isActivePaidAppMembership(
  membership: AppMembershipSnapshot,
  now: Date = new Date(),
): boolean {
  if (membership.status !== "active") return false;
  if (membership.tier !== "premium" && membership.tier !== "lifetime") return false;
  if (!membership.expiresAt) return true;
  return new Date(membership.expiresAt).getTime() >= now.getTime();
}

/**
 * Resolves access for one branded app.
 *
 * Brand membership records are authoritative once a paid subscription exists:
 * a single-brand subscription must not unlock the other app through the legacy
 * global user flag. The pre-brand global flag belongs to the original AAUS
 * app only, so it never unlocks iHeartEcho while historic accounts are being
 * reconciled.
 */
export function resolveAppPremiumFromMemberships(input: {
  brand: Brand;
  memberships: AppMembershipSnapshot[];
  legacyIsPremium: boolean;
  now?: Date;
}): boolean {
  const { brand, memberships, legacyIsPremium, now } = input;
  const hasPaidMembership = memberships.some((membership) =>
    membership.tier === "premium" || membership.tier === "lifetime",
  );
  if (hasPaidMembership) {
    return memberships.some(
      (membership) => membership.brand === brand && isActivePaidAppMembership(membership, now),
    );
  }
  return legacyIsPremium && brand === "aaus";
}

/** Returns the explicit paid entitlement for the requested brand only. */
export function hasExplicitBrandPremium(input: {
  brand: Brand;
  memberships: AppMembershipSnapshot[];
  now?: Date;
}): boolean {
  return input.memberships.some(
    (membership) => membership.brand === input.brand && isActivePaidAppMembership(membership, input.now),
  );
}

export async function resolveAppPremiumEntitlement(input: {
  userId: number;
  brand: Brand;
  legacyIsPremium: boolean;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return input.legacyIsPremium && input.brand === "aaus";

  try {
    const memberships = await db
      .select({
        brand: brandMemberships.brand,
        tier: brandMemberships.tier,
        status: brandMemberships.status,
        expiresAt: brandMemberships.expiresAt,
      })
      .from(brandMemberships)
      .where(eq(brandMemberships.userId, input.userId));

    return resolveAppPremiumFromMemberships({
      brand: input.brand,
      memberships,
      legacyIsPremium: input.legacyIsPremium,
    });
  } catch (error) {
    console.error("[AppPremiumEntitlement] Could not resolve brand membership access:", error);
    return input.legacyIsPremium && input.brand === "aaus";
  }
}

export async function resolveExplicitBrandPremium(input: {
  userId: number;
  brand: Brand;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const memberships = await db
      .select({
        brand: brandMemberships.brand,
        tier: brandMemberships.tier,
        status: brandMemberships.status,
        expiresAt: brandMemberships.expiresAt,
      })
      .from(brandMemberships)
      .where(eq(brandMemberships.userId, input.userId));
    return hasExplicitBrandPremium({ brand: input.brand, memberships });
  } catch (error) {
    console.error("[AppPremiumEntitlement] Could not resolve explicit brand access:", error);
    return false;
  }
}
