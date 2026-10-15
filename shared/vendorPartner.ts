export const VENDOR_PARTNER_SCOPES = ["aaus_ihe", "ultrasound_expo"] as const;
export type VendorPartnerScope = (typeof VENDOR_PARTNER_SCOPES)[number];

export const VENDOR_PARTNER_TYPES = ["vendor", "exhibitor", "sponsor"] as const;
export type VendorPartnerType = (typeof VENDOR_PARTNER_TYPES)[number];

export const VENDOR_PARTNER_SCOPE_LABELS: Record<VendorPartnerScope, string> = {
  aaus_ihe: "All About Ultrasound™ | iHeartEcho™",
  ultrasound_expo: "UltrasoundExpo™",
};

export const VENDOR_PARTNER_TYPE_LABELS: Record<VendorPartnerType, string> = {
  vendor: "Vendor",
  exhibitor: "Exhibitor",
  sponsor: "Sponsor",
};

export type VendorApprovalRecord = {
  status: string;
  linkedUserId: number | null;
  aausAccess: boolean;
  expoAccess: boolean;
};

export function isVendorPartnerScope(value: string): value is VendorPartnerScope {
  return (VENDOR_PARTNER_SCOPES as readonly string[]).includes(value);
}

export function isVendorPartnerType(value: string): value is VendorPartnerType {
  return (VENDOR_PARTNER_TYPES as readonly string[]).includes(value);
}

/**
 * Access is intentionally tied to the approved shared-account user ID, never an
 * email supplied by a caller. This prevents an email-only vendor portal bypass.
 */
export function isApprovedVendorForScope(
  application: VendorApprovalRecord | null | undefined,
  userId: number,
  scope: VendorPartnerScope,
): boolean {
  if (!application || application.status !== "approved" || application.linkedUserId !== userId) return false;
  return scope === "aaus_ihe" ? application.aausAccess === true : application.expoAccess === true;
}

export function parseVendorPartnerValues<T extends string>(
  raw: string | null | undefined,
  allowed: readonly T[],
): T[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is T => typeof item === "string" && (allowed as readonly string[]).includes(item));
  } catch {
    return [];
  }
}
