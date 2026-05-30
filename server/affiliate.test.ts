import { describe, it, expect } from "vitest";

/**
 * Affiliate system unit tests — validates core business logic
 * without requiring a live database connection.
 */

// ─── Affiliate link slug generation ──────────────────────────────────────────

function generateSlug(affiliateName: string, courseSlug: string): string {
  const base = `${affiliateName}-${courseSlug}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base.substring(0, 60);
}

describe("Affiliate link slug generation", () => {
  it("generates a valid slug from affiliate name and course slug", () => {
    const slug = generateSlug("Jane Doe", "intro-to-ultrasound");
    expect(slug).toBe("jane-doe-intro-to-ultrasound");
  });

  it("collapses multiple dashes", () => {
    const slug = generateSlug("John  Smith", "course--name");
    expect(slug).not.toMatch(/--/);
  });

  it("strips leading and trailing dashes", () => {
    const slug = generateSlug("-bad-", "-course-");
    expect(slug).not.toMatch(/^-|-$/);
  });

  it("truncates to 60 characters", () => {
    const longName = "a".repeat(40);
    const longCourse = "b".repeat(40);
    const slug = generateSlug(longName, longCourse);
    expect(slug.length).toBeLessThanOrEqual(60);
  });
});

// ─── Commission calculation ───────────────────────────────────────────────────

function calculateCommission(
  saleAmount: number,
  globalPct: number,
  overridePct: number | null
): number {
  const pct = overridePct ?? globalPct;
  return Math.round((saleAmount * pct) / 100 * 100) / 100;
}

describe("Commission calculation", () => {
  it("uses global commission percentage when no override", () => {
    expect(calculateCommission(100, 20, null)).toBe(20);
  });

  it("uses override percentage when provided", () => {
    expect(calculateCommission(100, 20, 30)).toBe(30);
  });

  it("handles zero commission", () => {
    expect(calculateCommission(100, 0, null)).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    expect(calculateCommission(99.99, 15, null)).toBe(15);
  });
});

// ─── Payout method validation ─────────────────────────────────────────────────

type PayoutMethod = "stripe" | "paypal" | "bank_ach";

function isValidPayoutMethod(method: string): method is PayoutMethod {
  return ["stripe", "paypal", "bank_ach"].includes(method);
}

describe("Payout method validation", () => {
  it("accepts valid payout methods", () => {
    expect(isValidPayoutMethod("stripe")).toBe(true);
    expect(isValidPayoutMethod("paypal")).toBe(true);
    expect(isValidPayoutMethod("bank_ach")).toBe(true);
  });

  it("rejects invalid payout methods", () => {
    expect(isValidPayoutMethod("bitcoin")).toBe(false);
    expect(isValidPayoutMethod("")).toBe(false);
    expect(isValidPayoutMethod("cash")).toBe(false);
  });
});

// ─── Affiliate course access check ───────────────────────────────────────────

interface CourseAccess {
  affiliateId: number;
  courseId: number;
}

function hasAccess(accessList: CourseAccess[], affiliateId: number, courseId: number): boolean {
  return accessList.some(a => a.affiliateId === affiliateId && a.courseId === courseId);
}

describe("Affiliate course access check", () => {
  const accessList: CourseAccess[] = [
    { affiliateId: 1, courseId: 10 },
    { affiliateId: 1, courseId: 20 },
    { affiliateId: 2, courseId: 10 },
  ];

  it("returns true when affiliate has access to course", () => {
    expect(hasAccess(accessList, 1, 10)).toBe(true);
    expect(hasAccess(accessList, 2, 10)).toBe(true);
  });

  it("returns false when affiliate does not have access", () => {
    expect(hasAccess(accessList, 2, 20)).toBe(false);
    expect(hasAccess(accessList, 3, 10)).toBe(false);
  });
});
