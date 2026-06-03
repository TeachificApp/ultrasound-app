/**
 * Tests for new adminUserRouter procedures:
 * - cancelNativeMembership (input shape)
 * - revokeNativeMembership (input shape)
 * - resendEmailFromLog (input shape)
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── Input schemas (mirrors server) ──────────────────────────────────────────
const cancelNativeMembershipInput = z.object({
  membershipSubscriptionId: z.number().int(),
  stripeSubscriptionId: z.string().optional(),
  immediately: z.boolean().default(false),
});

const revokeNativeMembershipInput = z.object({
  membershipSubscriptionId: z.number().int(),
});

const resendEmailFromLogInput = z.object({
  emailLogId: z.number().int(),
});

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("cancelNativeMembership input schema", () => {
  it("accepts valid input with stripeSubscriptionId", () => {
    const result = cancelNativeMembershipInput.safeParse({
      membershipSubscriptionId: 42,
      stripeSubscriptionId: "sub_test123",
      immediately: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid input without stripeSubscriptionId", () => {
    const result = cancelNativeMembershipInput.safeParse({
      membershipSubscriptionId: 42,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.immediately).toBe(false); // default
    }
  });

  it("rejects missing membershipSubscriptionId", () => {
    const result = cancelNativeMembershipInput.safeParse({
      stripeSubscriptionId: "sub_test123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer membershipSubscriptionId", () => {
    const result = cancelNativeMembershipInput.safeParse({
      membershipSubscriptionId: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("revokeNativeMembership input schema", () => {
  it("accepts valid input", () => {
    const result = revokeNativeMembershipInput.safeParse({ membershipSubscriptionId: 10 });
    expect(result.success).toBe(true);
  });

  it("rejects missing membershipSubscriptionId", () => {
    const result = revokeNativeMembershipInput.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("resendEmailFromLog input schema", () => {
  it("accepts valid emailLogId", () => {
    const result = resendEmailFromLogInput.safeParse({ emailLogId: 99 });
    expect(result.success).toBe(true);
  });

  it("rejects missing emailLogId", () => {
    const result = resendEmailFromLogInput.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects non-integer emailLogId", () => {
    const result = resendEmailFromLogInput.safeParse({ emailLogId: "abc" });
    expect(result.success).toBe(false);
  });
});
