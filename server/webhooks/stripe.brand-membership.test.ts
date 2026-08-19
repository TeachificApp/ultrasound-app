/**
 * stripe.brand-membership.test.ts
 *
 * Integration tests for the guest-recovery paths in:
 *  - handleBrandMembershipCheckoutCompleted
 *  - handleDualMembershipCheckoutCompleted
 *
 * These tests verify that when a buyer completes checkout without being logged
 * in (no user_id in metadata), the handlers:
 *  1. Call getOrCreateUserByEmail to resolve / create an account
 *  2. Insert a brandMemberships row for the correct brand(s)
 *  3. Attempt to send a welcome email for newly created accounts
 *  4. Notify the owner on success
 *  5. Bail out gracefully and alert the owner when no email is available
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks ────────────────────────────────────────────────────────────

// Mock the DB module so tests never touch a real database
vi.mock("../../server/db", () => ({
  getDb: vi.fn(),
  getUserByEmail: vi.fn(),
  getOrCreateUserByEmail: vi.fn(),
  getOrCreateAccessToken: vi.fn(),
}));

// Mock the notification helper
vi.mock("../../server/_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Mock the email helper (dynamic import inside the handler)
vi.mock("../../server/_core/email", () => ({
  buildPasswordResetEmail: vi.fn().mockReturnValue({
    htmlBody: "<html><body>Welcome</body></html>",
    subject: "Welcome",
  }),
  emailWrapper: vi.fn((body: string) => body),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../server/lib/stripeClient", () => ({
  getStripeClient: vi.fn(() => ({
    subscriptions: { update: vi.fn().mockResolvedValue({}) },
  })),
}));

// Mock Thinkific (dynamic import inside the dual handler)
vi.mock("../../server/thinkific", () => ({
  findOrCreateThinkificUser: vi.fn().mockResolvedValue(undefined),
}));

// ─── Imports (after mocks are registered) ────────────────────────────────────

import * as dbModule from "../db";
import { notifyOwner } from "../_core/notification";
import {
  handleBrandMembershipCheckoutCompleted,
  handleDualMembershipCheckoutCompleted,
} from "./stripe";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal Drizzle-like DB mock that records inserts and updates */
function buildDbMock() {
  const insertedRows: Record<string, unknown>[] = [];
  const updatedRows: Record<string, unknown>[] = [];

  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]), // no existing membership by default
  };

  const insertChain = {
    values: vi.fn().mockImplementation((row) => {
      insertedRows.push(row);
      return Promise.resolve();
    }),
  };

  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation((row) => {
      updatedRows.push(row);
      return Promise.resolve();
    }),
  };

  const db = {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
    _insertedRows: insertedRows,
    _updatedRows: updatedRows,
    _selectChain: selectChain,
  };

  return db;
}

/** Minimal session with no user_id (guest checkout) */
function guestBrandSession(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "cs_test_guest_brand_001",
    customer_email: "guest@example.com",
    customer_details: { email: "guest@example.com" },
    metadata: {
      type: "brand_membership_upgrade",
      brand: "aaus",
      customer_email: "guest@example.com",
      customer_name: "Guest User",
      // NOTE: user_id intentionally absent
    },
    subscription: "sub_test_brand_001",
    customer: "cus_test_brand_001",
    ...overrides,
  };
}

/** Minimal session with no user_id for dual membership */
function guestDualSession(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "cs_test_guest_dual_001",
    customer_email: "dual@example.com",
    customer_details: { email: "dual@example.com" },
    metadata: {
      type: "dual_membership",
      customer_email: "dual@example.com",
      customer_name: "Dual User",
      // NOTE: user_id intentionally absent
    },
    subscription: "sub_test_dual_001",
    customer: "cus_test_dual_001",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("handleBrandMembershipCheckoutCompleted — guest recovery", () => {
  let db: ReturnType<typeof buildDbMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    db = buildDbMock();
    vi.mocked(dbModule.getDb).mockResolvedValue(db as any);
    vi.mocked(dbModule.getOrCreateAccessToken).mockResolvedValue("test-access-token");
  });

  it("auto-creates an account and inserts a premium brandMembership when user_id is absent", async () => {
    vi.mocked(dbModule.getOrCreateUserByEmail).mockResolvedValue({
      user: { id: 42, email: "guest@example.com", firstName: "Guest", lastName: "User", name: "Guest User" },
      isNew: true,
      resetToken: "reset-token-abc",
    });

    await handleBrandMembershipCheckoutCompleted(guestBrandSession());

    // getOrCreateUserByEmail must have been called with the checkout email
    expect(dbModule.getOrCreateUserByEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: "guest@example.com" })
    );

    // A new brandMembership row must have been inserted
    expect(db.insert).toHaveBeenCalled();
    const insertedRow = db._insertedRows[0] as Record<string, unknown>;
    expect(insertedRow).toMatchObject({
      userId: 42,
      brand: "aaus",
      tier: "premium",
      status: "active",
    });
  });

  it("resolves an existing account and grants membership without creating a new user", async () => {
    vi.mocked(dbModule.getOrCreateUserByEmail).mockResolvedValue({
      user: { id: 99, email: "guest@example.com", firstName: "Guest", lastName: "User", name: "Guest User" },
      isNew: false,
      resetToken: null,
    });

    await handleBrandMembershipCheckoutCompleted(guestBrandSession());

    expect(dbModule.getOrCreateUserByEmail).toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalled();
    const insertedRow = db._insertedRows[0] as Record<string, unknown>;
    expect(insertedRow).toMatchObject({ userId: 99, brand: "aaus", tier: "premium" });
  });

  it("updates an existing membership row instead of inserting when one already exists", async () => {
    vi.mocked(dbModule.getOrCreateUserByEmail).mockResolvedValue({
      user: { id: 42, email: "guest@example.com", firstName: "Guest", lastName: "User", name: "Guest User" },
      isNew: false,
      resetToken: null,
    });

    // Simulate existing membership record
    db._selectChain.limit.mockResolvedValue([{
      id: 7,
      userId: 42,
      brand: "aaus",
      tier: "free",
      status: "active",
    }]);

    await handleBrandMembershipCheckoutCompleted(guestBrandSession());

    // Should update, not insert
    expect(db.update).toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("sends a welcome email when a new account is auto-created", async () => {
    vi.mocked(dbModule.getOrCreateUserByEmail).mockResolvedValue({
      user: { id: 42, email: "guest@example.com", firstName: "Guest", lastName: "User", name: "Guest User" },
      isNew: true,
      resetToken: "reset-token-abc",
    });

    await handleBrandMembershipCheckoutCompleted(guestBrandSession());

    // Dynamic import of email module — check via the module mock
    const emailModule = await import("../_core/email");
    expect(emailModule.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.objectContaining({ email: "guest@example.com" }),
      })
    );
  });

  it("sends an access-confirmation email for existing accounts without issuing a welcome reset", async () => {
    vi.mocked(dbModule.getOrCreateUserByEmail).mockResolvedValue({
      user: { id: 99, email: "guest@example.com", firstName: "Guest", lastName: "User", name: "Guest User" },
      isNew: false,
      resetToken: null,
    });

    await handleBrandMembershipCheckoutCompleted(guestBrandSession());

    const emailModule = await import("../_core/email");
    expect(emailModule.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: expect.objectContaining({ email: "guest@example.com" }),
      subject: expect.stringContaining("Premium Membership"),
    }));
  });

  it("notifies the owner and returns early when no email is available", async () => {
    const session = guestBrandSession({
      customer_email: null,
      customer_details: null,
      metadata: {
        type: "brand_membership_upgrade",
        brand: "aaus",
        // no customer_email, no user_id
      },
    });

    await handleBrandMembershipCheckoutCompleted(session);

    // No account creation attempted
    expect(dbModule.getOrCreateUserByEmail).not.toHaveBeenCalled();
    // Owner should be alerted
    expect(notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("No User ID") })
    );
    // No DB write
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("returns early without error when metadata.type is not brand_membership_upgrade", async () => {
    const session = guestBrandSession({
      metadata: { type: "lms_course", brand: "aaus", customer_email: "guest@example.com" },
    });

    await handleBrandMembershipCheckoutCompleted(session);

    expect(dbModule.getOrCreateUserByEmail).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("handleDualMembershipCheckoutCompleted — guest recovery", () => {
  let db: ReturnType<typeof buildDbMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    db = buildDbMock();
    vi.mocked(dbModule.getDb).mockResolvedValue(db as any);
    vi.mocked(dbModule.getOrCreateAccessToken).mockResolvedValue("test-access-token");
  });

  it("auto-creates an account and inserts premium memberships for BOTH brands when user_id is absent", async () => {
    vi.mocked(dbModule.getOrCreateUserByEmail).mockResolvedValue({
      user: { id: 55, email: "dual@example.com", firstName: "Dual", lastName: "User", name: "Dual User" },
      isNew: true,
      resetToken: "reset-token-dual",
    });

    await handleDualMembershipCheckoutCompleted(guestDualSession());

    expect(dbModule.getOrCreateUserByEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: "dual@example.com" })
    );

    // Two entitlement rows — one per brand. Purchase logging can add a
    // separate non-entitlement record and must not weaken this assertion.
    const membershipRows = db._insertedRows.filter((r: any) => r.brand);
    expect(membershipRows).toHaveLength(2);
    const brands = membershipRows.map((r: any) => r.brand);
    expect(brands).toContain("aaus");
    expect(brands).toContain("iheartecho");

    // Both rows should be premium
    for (const row of membershipRows as any[]) {
      expect(row).toMatchObject({ userId: 55, tier: "premium", status: "active" });
    }
  });

  it("handles dual_membership_lifetime type and sets source to stripe_dual_lifetime", async () => {
    vi.mocked(dbModule.getOrCreateUserByEmail).mockResolvedValue({
      user: { id: 55, email: "dual@example.com", firstName: "Dual", lastName: "User", name: "Dual User" },
      isNew: false,
      resetToken: null,
    });

    const lifetimeSession = guestDualSession({
      metadata: {
        type: "dual_membership_lifetime",
        customer_email: "dual@example.com",
        customer_name: "Dual User",
      },
    });

    await handleDualMembershipCheckoutCompleted(lifetimeSession);

    const membershipRows = db._insertedRows.filter((r: any) => r.brand);
    expect(membershipRows).toHaveLength(2);
    for (const row of membershipRows as any[]) {
      expect(row.source).toBe("stripe_dual_lifetime");
    }
  });

  it("sends a welcome email for new accounts on dual membership", async () => {
    vi.mocked(dbModule.getOrCreateUserByEmail).mockResolvedValue({
      user: { id: 55, email: "dual@example.com", firstName: "Dual", lastName: "User", name: "Dual User" },
      isNew: true,
      resetToken: "reset-token-dual",
    });

    await handleDualMembershipCheckoutCompleted(guestDualSession());

    const emailModule = await import("../_core/email");
    expect(emailModule.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.objectContaining({ email: "dual@example.com" }),
      })
    );
  });

  it("notifies the owner and returns early when no email is available", async () => {
    const session = guestDualSession({
      customer_email: null,
      customer_details: null,
      metadata: {
        type: "dual_membership",
        // no customer_email, no user_id
      },
    });

    await handleDualMembershipCheckoutCompleted(session);

    expect(dbModule.getOrCreateUserByEmail).not.toHaveBeenCalled();
    expect(notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("No User ID") })
    );
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("returns early without error when metadata.type is not a dual membership type", async () => {
    const session = guestDualSession({
      metadata: { type: "lms_course", customer_email: "dual@example.com" },
    });

    await handleDualMembershipCheckoutCompleted(session);

    expect(dbModule.getOrCreateUserByEmail).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
});
