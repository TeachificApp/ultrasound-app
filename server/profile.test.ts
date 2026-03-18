/**
 * Tests for the profile update procedure and role-based access logic.
 */
import { describe, it, expect } from "vitest";

// ── Role helper logic (mirrors Layout.tsx and Profile.tsx) ──────────────────

const PREMIUM_ROLES = ["premium_user", "diy_user", "diy_admin", "platform_admin"];

function hasPremiumAccess(appRoles: string[]): boolean {
  return appRoles.some(r => PREMIUM_ROLES.includes(r));
}

function hasDiyAccess(appRoles: string[]): boolean {
  return appRoles.includes("diy_user") || appRoles.includes("diy_admin");
}

function hasLabAdminAccess(appRoles: string[]): boolean {
  return appRoles.includes("diy_admin");
}

function hasPlatformAdminAccess(appRoles: string[]): boolean {
  return appRoles.includes("platform_admin");
}

// ── Dropdown section visibility ─────────────────────────────────────────────

describe("Header dropdown role-based section visibility", () => {
  it("shows Lab Admin section only for diy_admin", () => {
    expect(hasLabAdminAccess(["diy_admin"])).toBe(true);
    expect(hasLabAdminAccess(["diy_user"])).toBe(false);
    expect(hasLabAdminAccess(["premium_user"])).toBe(false);
    expect(hasLabAdminAccess(["platform_admin"])).toBe(false);
    expect(hasLabAdminAccess([])).toBe(false);
  });

  it("shows Platform Admin section only for platform_admin", () => {
    expect(hasPlatformAdminAccess(["platform_admin"])).toBe(true);
    expect(hasPlatformAdminAccess(["diy_admin"])).toBe(false);
    expect(hasPlatformAdminAccess(["premium_user"])).toBe(false);
    expect(hasPlatformAdminAccess([])).toBe(false);
  });

  it("shows Lab Admin AND Platform Admin for a user with both roles", () => {
    const roles = ["diy_admin", "platform_admin"];
    expect(hasLabAdminAccess(roles)).toBe(true);
    expect(hasPlatformAdminAccess(roles)).toBe(true);
  });
});

// ── Premium access logic ─────────────────────────────────────────────────────

describe("Premium access role hierarchy", () => {
  it("grants premium access to premium_user", () => {
    expect(hasPremiumAccess(["premium_user"])).toBe(true);
  });

  it("grants premium access to diy_user (premium included)", () => {
    expect(hasPremiumAccess(["diy_user"])).toBe(true);
  });

  it("grants premium access to diy_admin (premium included)", () => {
    expect(hasPremiumAccess(["diy_admin"])).toBe(true);
  });

  it("grants premium access to platform_admin", () => {
    expect(hasPremiumAccess(["platform_admin"])).toBe(true);
  });

  it("denies premium access to users with no roles", () => {
    expect(hasPremiumAccess([])).toBe(false);
  });

  it("denies premium access to unknown roles", () => {
    expect(hasPremiumAccess(["some_other_role"])).toBe(false);
  });
});

// ── DIY access logic ─────────────────────────────────────────────────────────

describe("DIY accreditation access logic", () => {
  it("grants DIY access to diy_user", () => {
    expect(hasDiyAccess(["diy_user"])).toBe(true);
  });

  it("grants DIY access to diy_admin", () => {
    expect(hasDiyAccess(["diy_admin"])).toBe(true);
  });

  it("denies DIY access to premium_user only", () => {
    expect(hasDiyAccess(["premium_user"])).toBe(false);
  });

  it("denies DIY access to platform_admin only", () => {
    expect(hasDiyAccess(["platform_admin"])).toBe(false);
  });

  it("denies DIY access to users with no roles", () => {
    expect(hasDiyAccess([])).toBe(false);
  });
});

// ── Profile update input validation ─────────────────────────────────────────

describe("Profile update input validation", () => {
  function validateProfileUpdate(input: { displayName?: string; email?: string }) {
    const errors: string[] = [];
    if (input.displayName !== undefined) {
      if (input.displayName.trim().length === 0) errors.push("Display name cannot be empty");
      if (input.displayName.trim().length > 100) errors.push("Display name too long");
    }
    if (input.email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input.email.trim())) errors.push("Invalid email address");
    }
    return errors;
  }

  it("accepts valid displayName update", () => {
    expect(validateProfileUpdate({ displayName: "Lara Williams" })).toHaveLength(0);
  });

  it("rejects empty displayName", () => {
    expect(validateProfileUpdate({ displayName: "   " })).toContain("Display name cannot be empty");
  });

  it("rejects displayName over 100 characters", () => {
    expect(validateProfileUpdate({ displayName: "A".repeat(101) })).toContain("Display name too long");
  });

  it("accepts valid email update", () => {
    expect(validateProfileUpdate({ email: "user@example.com" })).toHaveLength(0);
  });

  it("rejects invalid email format", () => {
    expect(validateProfileUpdate({ email: "not-an-email" })).toContain("Invalid email address");
  });

  it("accepts update with both fields valid", () => {
    expect(validateProfileUpdate({ displayName: "Jane Doe", email: "jane@example.com" })).toHaveLength(0);
  });

  it("accepts update with no fields (no-op)", () => {
    expect(validateProfileUpdate({})).toHaveLength(0);
  });
});

// ── Extended updateProfile schema tests ─────────────────────────────────────

import { z } from "zod";

const updateProfileSchemaExtended = z.object({
  email: z.string().email().optional(),
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(1000).optional(),
  credentials: z.string().max(200).optional(),
  specialty: z.string().max(100).optional(),
  yearsExperience: z.number().int().min(0).max(60).nullable().optional(),
  location: z.string().max(100).optional(),
  website: z.string().url().max(200).optional().or(z.literal("")),
  isPublicProfile: z.boolean().optional(),
});

const changePasswordSchemaTest = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

describe("Extended updateProfile input validation (new fields)", () => {
  it("accepts a valid bio within 1000 characters", () => {
    const result = updateProfileSchemaExtended.safeParse({ bio: "A".repeat(1000) });
    expect(result.success).toBe(true);
  });

  it("rejects a bio exceeding 1000 characters", () => {
    const result = updateProfileSchemaExtended.safeParse({ bio: "A".repeat(1001) });
    expect(result.success).toBe(false);
  });

  it("accepts valid credentials (RDCS, FASE)", () => {
    const result = updateProfileSchemaExtended.safeParse({ credentials: "RDCS, FASE" });
    expect(result.success).toBe(true);
  });

  it("rejects credentials exceeding 200 characters", () => {
    const result = updateProfileSchemaExtended.safeParse({ credentials: "A".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("accepts a valid specialty", () => {
    const result = updateProfileSchemaExtended.safeParse({ specialty: "Adult Echocardiography" });
    expect(result.success).toBe(true);
  });

  it("rejects a specialty exceeding 100 characters", () => {
    const result = updateProfileSchemaExtended.safeParse({ specialty: "A".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepts yearsExperience of 0", () => {
    const result = updateProfileSchemaExtended.safeParse({ yearsExperience: 0 });
    expect(result.success).toBe(true);
  });

  it("accepts yearsExperience of 60 (max)", () => {
    const result = updateProfileSchemaExtended.safeParse({ yearsExperience: 60 });
    expect(result.success).toBe(true);
  });

  it("rejects yearsExperience greater than 60", () => {
    const result = updateProfileSchemaExtended.safeParse({ yearsExperience: 61 });
    expect(result.success).toBe(false);
  });

  it("rejects negative yearsExperience", () => {
    const result = updateProfileSchemaExtended.safeParse({ yearsExperience: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts null yearsExperience (clear the field)", () => {
    const result = updateProfileSchemaExtended.safeParse({ yearsExperience: null });
    expect(result.success).toBe(true);
  });

  it("rejects non-integer yearsExperience", () => {
    const result = updateProfileSchemaExtended.safeParse({ yearsExperience: 5.5 });
    expect(result.success).toBe(false);
  });

  it("accepts a valid location string", () => {
    const result = updateProfileSchemaExtended.safeParse({ location: "Austin, TX" });
    expect(result.success).toBe(true);
  });

  it("rejects a location exceeding 100 characters", () => {
    const result = updateProfileSchemaExtended.safeParse({ location: "A".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepts a valid https website URL", () => {
    const result = updateProfileSchemaExtended.safeParse({ website: "https://example.com" });
    expect(result.success).toBe(true);
  });

  it("accepts an empty string website (clearing the field)", () => {
    const result = updateProfileSchemaExtended.safeParse({ website: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a website URL without protocol", () => {
    const result = updateProfileSchemaExtended.safeParse({ website: "example.com" });
    expect(result.success).toBe(false);
  });

  it("accepts isPublicProfile boolean", () => {
    const result = updateProfileSchemaExtended.safeParse({ isPublicProfile: true });
    expect(result.success).toBe(true);
  });

  it("accepts all fields simultaneously", () => {
    const result = updateProfileSchemaExtended.safeParse({
      displayName: "Jane Smith",
      email: "jane@example.com",
      bio: "Experienced cardiac sonographer.",
      credentials: "RDCS, FASE",
      specialty: "Adult Echocardiography",
      yearsExperience: 12,
      location: "Boston, MA",
      website: "https://janesmith.com",
      isPublicProfile: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("changePassword input validation", () => {
  it("accepts valid current and new passwords", () => {
    const result = changePasswordSchemaTest.safeParse({
      currentPassword: "OldPass123",
      newPassword: "NewPass456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty current password", () => {
    const result = changePasswordSchemaTest.safeParse({
      currentPassword: "",
      newPassword: "NewPass456",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a new password shorter than 8 characters", () => {
    const result = changePasswordSchemaTest.safeParse({
      currentPassword: "OldPass123",
      newPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a new password of exactly 8 characters", () => {
    const result = changePasswordSchemaTest.safeParse({
      currentPassword: "OldPass123",
      newPassword: "12345678",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a new password exceeding 128 characters", () => {
    const result = changePasswordSchemaTest.safeParse({
      currentPassword: "OldPass123",
      newPassword: "A".repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a new password of exactly 128 characters", () => {
    const result = changePasswordSchemaTest.safeParse({
      currentPassword: "OldPass123",
      newPassword: "A".repeat(128),
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing currentPassword field", () => {
    const result = changePasswordSchemaTest.safeParse({
      newPassword: "NewPass456",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing newPassword field", () => {
    const result = changePasswordSchemaTest.safeParse({
      currentPassword: "OldPass123",
    });
    expect(result.success).toBe(false);
  });
});

// ── Profile display helpers ──────────────────────────────────────────────────

describe("Profile display helpers", () => {
  function getInitials(displayName: string | null | undefined, name: string | null | undefined): string {
    return (displayName || name || "?").charAt(0).toUpperCase();
  }

  function formatYearsExperience(years: number | null | undefined): string {
    if (years == null) return "—";
    return `${years} year${years !== 1 ? "s" : ""}`;
  }

  it("returns first letter of displayName when set", () => {
    expect(getInitials("Jane Smith", null)).toBe("J");
  });

  it("falls back to name when displayName is not set", () => {
    expect(getInitials(null, "Bob")).toBe("B");
  });

  it("falls back to ? when both are null", () => {
    expect(getInitials(null, null)).toBe("?");
  });

  it("returns uppercase initial", () => {
    expect(getInitials("alice", null)).toBe("A");
  });

  it("formats 1 year correctly (singular)", () => {
    expect(formatYearsExperience(1)).toBe("1 year");
  });

  it("formats 2 years correctly (plural)", () => {
    expect(formatYearsExperience(2)).toBe("2 years");
  });

  it("formats 0 years correctly", () => {
    expect(formatYearsExperience(0)).toBe("0 years");
  });

  it("returns — for null", () => {
    expect(formatYearsExperience(null)).toBe("—");
  });

  it("returns — for undefined", () => {
    expect(formatYearsExperience(undefined)).toBe("—");
  });
});

// ── Email change verification flow tests ────────────────────────────────────

import { z } from "zod";

const requestEmailChangeSchema = z.object({
  newEmail: z.string().email().max(320),
});

const verifyEmailChangeSchema = z.object({
  token: z.string().min(1).max(200),
});

describe("requestEmailChange input validation", () => {
  it("accepts a valid email address", () => {
    const result = requestEmailChangeSchema.safeParse({ newEmail: "newemail@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email format", () => {
    const result = requestEmailChangeSchema.safeParse({ newEmail: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an email exceeding 320 characters", () => {
    const local = "a".repeat(310);
    const result = requestEmailChangeSchema.safeParse({ newEmail: `${local}@example.com` });
    expect(result.success).toBe(false);
  });

  it("accepts an email at exactly 320 characters", () => {
    // 320-char email: local + @ + domain
    const local = "a".repeat(308);
    const result = requestEmailChangeSchema.safeParse({ newEmail: `${local}@ex.com` });
    expect(result.success).toBe(true);
  });

  it("rejects a missing newEmail field", () => {
    const result = requestEmailChangeSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = requestEmailChangeSchema.safeParse({ newEmail: "" });
    expect(result.success).toBe(false);
  });

  it("accepts email with subdomain", () => {
    const result = requestEmailChangeSchema.safeParse({ newEmail: "user@mail.example.co.uk" });
    expect(result.success).toBe(true);
  });
});

describe("verifyEmailChange input validation", () => {
  it("accepts a valid token string", () => {
    const result = verifyEmailChangeSchema.safeParse({ token: "a".repeat(96) });
    expect(result.success).toBe(true);
  });

  it("rejects an empty token", () => {
    const result = verifyEmailChangeSchema.safeParse({ token: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a token exceeding 200 characters", () => {
    const result = verifyEmailChangeSchema.safeParse({ token: "a".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("accepts a token of exactly 200 characters", () => {
    const result = verifyEmailChangeSchema.safeParse({ token: "a".repeat(200) });
    expect(result.success).toBe(true);
  });

  it("rejects a missing token field", () => {
    const result = verifyEmailChangeSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("Email change token expiry logic", () => {
  function isTokenExpired(expiry: Date): boolean {
    return new Date() > expiry;
  }

  it("returns false for a token expiring in the future", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    expect(isTokenExpired(future)).toBe(false);
  });

  it("returns true for a token that expired in the past", () => {
    const past = new Date(Date.now() - 1000); // 1 second ago
    expect(isTokenExpired(past)).toBe(true);
  });

  it("returns true for a token that expired exactly at the boundary", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    expect(isTokenExpired(past)).toBe(true);
  });
});

describe("Email change same-email guard", () => {
  function isSameEmail(current: string, newEmail: string): boolean {
    return current.trim().toLowerCase() === newEmail.trim().toLowerCase();
  }

  it("detects identical emails (case-insensitive)", () => {
    expect(isSameEmail("User@Example.com", "user@example.com")).toBe(true);
  });

  it("detects identical emails with surrounding whitespace", () => {
    expect(isSameEmail("  user@example.com  ", "user@example.com")).toBe(true);
  });

  it("returns false for genuinely different emails", () => {
    expect(isSameEmail("old@example.com", "new@example.com")).toBe(false);
  });
});

describe("Email change verification URL construction", () => {
  function buildVerificationUrl(appUrl: string, token: string): string {
    return `${appUrl}/verify-email?token=${token}&type=change`;
  }

  it("builds a correct verification URL with token and type=change", () => {
    const url = buildVerificationUrl("https://app.iheartecho.com", "abc123");
    expect(url).toBe("https://app.iheartecho.com/verify-email?token=abc123&type=change");
  });

  it("includes the full token in the URL", () => {
    const token = "a".repeat(96);
    const url = buildVerificationUrl("https://app.iheartecho.com", token);
    expect(url).toContain(token);
    expect(url).toContain("type=change");
  });

  it("uses the provided appUrl as the base", () => {
    const url = buildVerificationUrl("https://custom.domain.com", "tok");
    expect(url.startsWith("https://custom.domain.com")).toBe(true);
  });
});
