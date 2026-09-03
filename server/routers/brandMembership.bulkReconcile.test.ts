/**
 * brandMembership.bulkReconcile.test.ts
 *
 * Robust tests for the bulkReconcileBrandMemberships admin procedure.
 *
 * Covers:
 *  - Successful brand subscription reconcile → handleBrandMembershipCheckoutCompleted called
 *  - Successful dual subscription reconcile → handleDualMembershipCheckoutCompleted called
 *  - Successful lifetime brand session reconcile → handleBrandMembershipCheckoutCompleted called
 *  - Successful lifetime dual session reconcile → handleDualMembershipCheckoutCompleted called
 *  - Dry-run mode: no webhook handlers called, status = dry_run
 *  - Cancelled subscription → skipped, no handler called
 *  - Non-brand subscription → skipped when no priceId filter
 *  - FORBIDDEN for non-admin users
 *  - UNAUTHORIZED for unauthenticated callers
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "../_core/context";

// ─── Module mocks — must be at top level before any imports ──────────────────

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  getUserByEmail: vi.fn(),
  getOrCreateUserByEmail: vi.fn(),
  getOrCreateAccessToken: vi.fn(),
}));

vi.mock("../_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Mock the webhook handlers — these are what bulkReconcile dispatches to
vi.mock("../webhooks/stripe", () => ({
  handleBrandMembershipCheckoutCompleted: vi.fn().mockResolvedValue(undefined),
  handleDualMembershipCheckoutCompleted: vi.fn().mockResolvedValue(undefined),
}));

// ─── Stripe mock factory ──────────────────────────────────────────────────────
// We mock stripe at the module level so the dynamic import("stripe") inside
// the procedure resolves to our controlled mock.

const mockStripeInstance = {
  subscriptions: { list: vi.fn() },
  checkout: { sessions: { list: vi.fn() } },
};

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => mockStripeInstance),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { notifyOwner } from "../_core/notification";
import * as stripeWebhook from "../webhooks/stripe";
import { appRouter } from "../routers";
import {
  BRAND_PRODUCTS,
  DUAL_MEMBERSHIP_PRODUCT,
} from "./brandMembershipRouter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-open-id",
      email: "admin@example.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

/** Empty Stripe responses — no subscriptions, no sessions */
function emptyStripe() {
  mockStripeInstance.subscriptions.list.mockResolvedValue({ data: [], has_more: false });
  mockStripeInstance.checkout.sessions.list.mockResolvedValue({ data: [], has_more: false });
}

/** Single active brand subscription */
function brandSubStripe(overrides: Record<string, unknown> = {}) {
  const sub = {
    id: "sub_brand_001",
    status: "active",
    metadata: { type: "brand_membership_upgrade", brand: "aaus", user_id: "42" },
    items: { data: [{ price: { id: BRAND_PRODUCTS.aaus.monthlyPriceId } }] },
    customer: { id: "cus_001", email: "user@example.com" },
    ...overrides,
  };
  mockStripeInstance.subscriptions.list.mockResolvedValue({ data: [sub], has_more: false });
  mockStripeInstance.checkout.sessions.list.mockResolvedValue({ data: [], has_more: false });
}

/** Single active dual subscription */
function dualSubStripe() {
  const sub = {
    id: "sub_dual_001",
    status: "active",
    metadata: { type: "dual_membership", user_id: "55" },
    items: { data: [{ price: { id: DUAL_MEMBERSHIP_PRODUCT.monthlyPriceId } }] },
    customer: { id: "cus_002", email: "dual@example.com" },
  };
  mockStripeInstance.subscriptions.list.mockResolvedValue({ data: [sub], has_more: false });
  mockStripeInstance.checkout.sessions.list.mockResolvedValue({ data: [], has_more: false });
}

/** Single paid lifetime brand session */
function lifetimeBrandSessionStripe() {
  mockStripeInstance.subscriptions.list.mockResolvedValue({ data: [], has_more: false });
  const session = {
    id: "cs_lifetime_brand_001",
    payment_status: "paid",
    customer_email: "lifetime@example.com",
    customer: { id: "cus_003", email: "lifetime@example.com" },
    metadata: { type: "brand_membership_upgrade", brand: "aaus", interval: "lifetime", user_id: "77" },
    line_items: { data: [{ price: { id: BRAND_PRODUCTS.aaus.legacyLifetimePriceId } }] },
  };
  mockStripeInstance.checkout.sessions.list.mockResolvedValue({ data: [session], has_more: false });
}

/** Single paid lifetime dual session */
function lifetimeDualSessionStripe() {
  mockStripeInstance.subscriptions.list.mockResolvedValue({ data: [], has_more: false });
  const session = {
    id: "cs_lifetime_dual_001",
    payment_status: "paid",
    customer_email: "duallift@example.com",
    customer: { id: "cus_004", email: "duallift@example.com" },
    metadata: { type: "dual_membership_lifetime", user_id: "88" },
    line_items: { data: [{ price: { id: DUAL_MEMBERSHIP_PRODUCT.legacyLifetimePriceId } }] },
  };
  mockStripeInstance.checkout.sessions.list.mockResolvedValue({ data: [session], has_more: false });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("brandMembership.bulkReconcileBrandMemberships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emptyStripe();
  });

  // ── Access control ──────────────────────────────────────────────────────────

  it("throws FORBIDDEN for non-admin users", async () => {
    const userCtx: TrpcContext = {
      ...adminCtx(),
      user: { ...adminCtx().user!, role: "user" },
    };
    const caller = appRouter.createCaller(userCtx);
    await expect(
      caller.brandMembership.bulkReconcileBrandMemberships({ limit: 10 })
    ).rejects.toThrow(/FORBIDDEN|Admin access required/i);
  });

  it("throws UNAUTHORIZED when called without a session", async () => {
    const anonCtx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(anonCtx);
    await expect(
      caller.brandMembership.bulkReconcileBrandMemberships({ limit: 10 })
    ).rejects.toThrow();
  });

  // ── Empty Stripe ────────────────────────────────────────────────────────────

  it("returns zero counts when Stripe has no matching objects", async () => {
    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.brandMembership.bulkReconcileBrandMemberships({ limit: 10 });

    expect(result.processed).toBe(0);
    expect(result.fulfilled).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.results).toEqual([]);
  });

  // ── Subscription reconcile ──────────────────────────────────────────────────

  it("calls handleBrandMembershipCheckoutCompleted for an active brand subscription", async () => {
    brandSubStripe();
    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.brandMembership.bulkReconcileBrandMemberships({ limit: 10 });

    expect(stripeWebhook.handleBrandMembershipCheckoutCompleted).toHaveBeenCalledTimes(1);
    expect(stripeWebhook.handleDualMembershipCheckoutCompleted).not.toHaveBeenCalled();
    expect(result.fulfilled).toBe(1);
    expect(result.errors).toBe(0);

    const row = result.results[0];
    expect(row.status).toBe("fulfilled");
    expect(row.stripeId).toBe("sub_brand_001");
    expect(row.type).toBe("subscription");
  });

  it("calls handleDualMembershipCheckoutCompleted for an active dual subscription", async () => {
    dualSubStripe();
    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.brandMembership.bulkReconcileBrandMemberships({ limit: 10 });

    expect(stripeWebhook.handleDualMembershipCheckoutCompleted).toHaveBeenCalledTimes(1);
    expect(stripeWebhook.handleBrandMembershipCheckoutCompleted).not.toHaveBeenCalled();
    expect(result.fulfilled).toBe(1);
    expect(result.errors).toBe(0);

    const row = result.results[0];
    expect(row.status).toBe("fulfilled");
    expect(row.stripeId).toBe("sub_dual_001");
  });

  it("skips a cancelled subscription and does not call any handler", async () => {
    brandSubStripe({ status: "canceled" });
    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.brandMembership.bulkReconcileBrandMemberships({ limit: 10 });

    expect(stripeWebhook.handleBrandMembershipCheckoutCompleted).not.toHaveBeenCalled();
    expect(stripeWebhook.handleDualMembershipCheckoutCompleted).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.fulfilled).toBe(0);
  });

  it("skips non-brand subscriptions when no priceId filter is given", async () => {
    const unrelatedSub = {
      id: "sub_unrelated_001",
      status: "active",
      metadata: { type: "lms_course" },
      items: { data: [{ price: { id: "price_unrelated_xyz" } }] },
      customer: { id: "cus_999", email: "other@example.com" },
    };
    mockStripeInstance.subscriptions.list.mockResolvedValue({ data: [unrelatedSub], has_more: false });
    mockStripeInstance.checkout.sessions.list.mockResolvedValue({ data: [], has_more: false });

    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.brandMembership.bulkReconcileBrandMemberships({ limit: 10 });

    expect(stripeWebhook.handleBrandMembershipCheckoutCompleted).not.toHaveBeenCalled();
    expect(result.fulfilled).toBe(0);
    // The unrelated sub is skipped (not counted as processed)
    expect(result.errors).toBe(0);
  });

  // ── Dry-run ─────────────────────────────────────────────────────────────────

  it("dry-run: does not call any webhook handler and returns dry_run status", async () => {
    brandSubStripe();
    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.brandMembership.bulkReconcileBrandMemberships({
      limit: 10,
      dryRun: true,
    });

    expect(stripeWebhook.handleBrandMembershipCheckoutCompleted).not.toHaveBeenCalled();
    expect(stripeWebhook.handleDualMembershipCheckoutCompleted).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(result.fulfilled).toBe(0);

    const dryRunItems = result.results.filter(r => r.status === "dry_run");
    expect(dryRunItems.length).toBe(1);
    expect(dryRunItems[0].stripeId).toBe("sub_brand_001");
  });

  // ── Lifetime session reconcile ──────────────────────────────────────────────

  it("calls handleBrandMembershipCheckoutCompleted for a paid lifetime brand session", async () => {
    lifetimeBrandSessionStripe();
    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.brandMembership.bulkReconcileBrandMemberships({ limit: 10 });

    expect(stripeWebhook.handleBrandMembershipCheckoutCompleted).toHaveBeenCalledTimes(1);
    expect(stripeWebhook.handleDualMembershipCheckoutCompleted).not.toHaveBeenCalled();
    expect(result.fulfilled).toBe(1);

    const row = result.results[0];
    expect(row.status).toBe("fulfilled");
    expect(row.stripeId).toBe("cs_lifetime_brand_001");
    expect(row.type).toBe("payment_intent");
  });

  it("calls handleDualMembershipCheckoutCompleted for a paid lifetime dual session", async () => {
    lifetimeDualSessionStripe();
    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.brandMembership.bulkReconcileBrandMemberships({ limit: 10 });

    expect(stripeWebhook.handleDualMembershipCheckoutCompleted).toHaveBeenCalledTimes(1);
    expect(stripeWebhook.handleBrandMembershipCheckoutCompleted).not.toHaveBeenCalled();
    expect(result.fulfilled).toBe(1);

    const row = result.results[0];
    expect(row.status).toBe("fulfilled");
    expect(row.stripeId).toBe("cs_lifetime_dual_001");
    expect(row.type).toBe("payment_intent");
  });

  it("skips an unpaid lifetime session", async () => {
    mockStripeInstance.subscriptions.list.mockResolvedValue({ data: [], has_more: false });
    const session = {
      id: "cs_unpaid_001",
      payment_status: "unpaid",
      customer_email: "unpaid@example.com",
      customer: { id: "cus_005", email: "unpaid@example.com" },
      metadata: { type: "dual_membership_lifetime" },
      line_items: { data: [{ price: { id: DUAL_MEMBERSHIP_PRODUCT.legacyLifetimePriceId } }] },
    };
    mockStripeInstance.checkout.sessions.list.mockResolvedValue({ data: [session], has_more: false });

    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.brandMembership.bulkReconcileBrandMemberships({ limit: 10 });

    expect(stripeWebhook.handleDualMembershipCheckoutCompleted).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.fulfilled).toBe(0);
  });

  // ── Price-ID-only lifetime matching (no metadata type) ─────────────────────

  it("reconciles a lifetime brand session when metadata is missing but canonical price ID is present", async () => {
    mockStripeInstance.subscriptions.list.mockResolvedValue({ data: [], has_more: false });
    const session = {
      id: "cs_priceid_brand_001",
      payment_status: "paid",
      customer_email: "pricematch@example.com",
      customer: { id: "cus_010", email: "pricematch@example.com" },
      // No metadata.type or metadata.interval — only canonical price ID
      metadata: { brand: "aaus", user_id: "99" },
      line_items: { data: [{ price: { id: BRAND_PRODUCTS.aaus.legacyLifetimePriceId } }] },
    };
    mockStripeInstance.checkout.sessions.list.mockResolvedValue({ data: [session], has_more: false });

    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.brandMembership.bulkReconcileBrandMemberships({ limit: 10 });

    // Should match via canonical price ID and call the brand handler
    expect(stripeWebhook.handleBrandMembershipCheckoutCompleted).toHaveBeenCalledTimes(1);
    expect(result.fulfilled).toBe(1);
  });

  it("reconciles a lifetime dual session when metadata is missing but canonical dual lifetime price ID is present", async () => {
    mockStripeInstance.subscriptions.list.mockResolvedValue({ data: [], has_more: false });
    const session = {
      id: "cs_priceid_dual_001",
      payment_status: "paid",
      customer_email: "dualpricematch@example.com",
      customer: { id: "cus_011", email: "dualpricematch@example.com" },
      // No metadata.type — only canonical dual lifetime price ID
      metadata: { user_id: "100" },
      line_items: { data: [{ price: { id: DUAL_MEMBERSHIP_PRODUCT.legacyLifetimePriceId } }] },
    };
    mockStripeInstance.checkout.sessions.list.mockResolvedValue({ data: [session], has_more: false });

    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.brandMembership.bulkReconcileBrandMemberships({ limit: 10 });

    // Should match via canonical price ID and call the dual handler
    expect(stripeWebhook.handleDualMembershipCheckoutCompleted).toHaveBeenCalledTimes(1);
    expect(result.fulfilled).toBe(1);
  });

  // ── Error isolation ─────────────────────────────────────────────────────────

  it("records an error result when a handler throws, without aborting the batch", async () => {
    brandSubStripe();
    vi.mocked(stripeWebhook.handleBrandMembershipCheckoutCompleted).mockRejectedValueOnce(
      new Error("Simulated DB failure")
    );

    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.brandMembership.bulkReconcileBrandMemberships({ limit: 10 });

    expect(result.errors).toBe(1);
    expect(result.fulfilled).toBe(0);
    const errRow = result.results.find(r => r.status === "error");
    expect(errRow?.error).toContain("Simulated DB failure");
  });

  // ── Owner notification ──────────────────────────────────────────────────────

  it("notifies the owner on completion with a summary", async () => {
    const caller = appRouter.createCaller(adminCtx());
    await caller.brandMembership.bulkReconcileBrandMemberships({ limit: 10 });

    expect(notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("Bulk Brand Membership Reconcile"),
        content: expect.stringContaining("Processed"),
      })
    );
  });
});
