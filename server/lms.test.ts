/**
 * LMS — Unit tests for slug generation, enrollment helpers, and affiliate logic.
 */
import { describe, it, expect } from "vitest";

// ── Slug generation ────────────────────────────────────────────────────────────
function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

describe("slugify", () => {
  it("converts spaces to hyphens", () => {
    expect(slugify("Introduction to Echo")).toBe("introduction-to-echo");
  });
  it("strips special characters", () => {
    expect(slugify("Echo 101: Basics & Beyond!")).toBe("echo-101-basics-beyond");
  });
  it("collapses multiple hyphens", () => {
    expect(slugify("A  B   C")).toBe("a-b-c");
  });
  it("trims leading/trailing whitespace", () => {
    expect(slugify("  Echo  ")).toBe("echo");
  });
});

// ── Enrollment status helpers ──────────────────────────────────────────────────
type EnrollmentStatus = "active" | "expired" | "pending";

function isEnrollmentActive(status: EnrollmentStatus, expiresAt: number | null): boolean {
  if (status !== "active") return false;
  if (expiresAt === null) return true;
  return expiresAt > Date.now();
}

describe("isEnrollmentActive", () => {
  it("returns true for active with no expiry", () => {
    expect(isEnrollmentActive("active", null)).toBe(true);
  });
  it("returns true for active with future expiry", () => {
    expect(isEnrollmentActive("active", Date.now() + 86400000)).toBe(true);
  });
  it("returns false for active with past expiry", () => {
    expect(isEnrollmentActive("active", Date.now() - 1000)).toBe(false);
  });
  it("returns false for non-active status", () => {
    expect(isEnrollmentActive("expired", null)).toBe(false);
    expect(isEnrollmentActive("pending", null)).toBe(false);
  });
});

// ── Affiliate commission calculation ──────────────────────────────────────────
function calcCommission(priceInCents: number, commissionPct: number): number {
  return Math.round((priceInCents * commissionPct) / 100);
}

describe("calcCommission", () => {
  it("calculates 10% commission on $99", () => {
    expect(calcCommission(9900, 10)).toBe(990);
  });
  it("calculates 20% commission on $199", () => {
    expect(calcCommission(19900, 20)).toBe(3980);
  });
  it("rounds fractional cents", () => {
    expect(calcCommission(999, 10)).toBe(100); // 99.9 → 100
  });
  it("returns 0 for 0% commission", () => {
    expect(calcCommission(9900, 0)).toBe(0);
  });
});

// ── Group seat availability ────────────────────────────────────────────────────
function availableSeats(totalSeats: number, assignedSeats: number): number {
  return Math.max(0, totalSeats - assignedSeats);
}

describe("availableSeats", () => {
  it("returns remaining seats", () => {
    expect(availableSeats(10, 3)).toBe(7);
  });
  it("returns 0 when fully allocated", () => {
    expect(availableSeats(5, 5)).toBe(0);
  });
  it("never returns negative", () => {
    expect(availableSeats(3, 5)).toBe(0);
  });
});

// ── Course visibility ──────────────────────────────────────────────────────────
type CourseStatus = "draft" | "published" | "hidden" | "private";

function isPubliclyVisible(status: CourseStatus): boolean {
  return status === "published";
}

describe("isPubliclyVisible", () => {
  it("only published courses are publicly visible", () => {
    expect(isPubliclyVisible("published")).toBe(true);
    expect(isPubliclyVisible("draft")).toBe(false);
    expect(isPubliclyVisible("hidden")).toBe(false);
    expect(isPubliclyVisible("private")).toBe(false);
  });
});
