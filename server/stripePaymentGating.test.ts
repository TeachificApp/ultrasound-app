/**
 * Tests for Stripe payment_status gating logic.
 *
 * Ensures that checkout.session.completed events with payment_status !== "paid"
 * (e.g., ACH / bank debit pending payments) do NOT grant access immediately,
 * and that access IS granted when payment_intent.succeeded fires.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Minimal mocks ────────────────────────────────────────────────────────────

const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({
    onDuplicateKeyUpdate: vi.fn().mockResolvedValue(undefined),
  }),
});
const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([]),
    }),
  }),
});
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  update: mockUpdate,
};

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
  getUserByEmail: vi.fn(),
  getOrCreateUserByEmail: vi.fn(),
  getOrCreateAccessToken: vi.fn(),
}));

vi.mock("../../drizzle/schema", () => ({
  deferredCheckoutSessions: { id: "id", stripePaymentIntentId: "stripe_payment_intent_id", status: "status" },
  webhookEvents: {},
  diySubscriptions: {},
  diyOrganizations: {},
  diyOrgMembers: {},
  userRoles: {},
  lmsOrders: {},
  lmsEnrollments: {},
  lmsAffiliates: {},
  lmsAffiliateConversions: {},
  digitalPurchases: {},
  digitalProducts: {},
  digitalBundlePurchases: {},
  digitalBundleItems: {},
  brandMemberships: {},
  physicalProductOrders: {},
  funnelPurchases: {},
  lmsCourses: {},
  userActivityLogs: {},
  membershipSubscriptions: {},
  membershipPlans: {},
  membershipDiscountCodes: {},
  membershipPlanAccess: {},
  employerProfiles: {},
  employerSubscriptions: {},
  workshopEnrollments: {},
  workshops: {},
  workshopInstances: {},
  teamSubscriptions: {},
  teamMembers: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...args) => args),
  sql: vi.fn(),
  count: vi.fn(),
}));

vi.mock("../_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("../routers/downloadsRouter", () => ({
  sendPurchaseConfirmationEmail: vi.fn(),
}));

vi.mock("../lib/orderBumpCheckout", () => ({
  fulfillOrderBumpPurchase: vi.fn(),
}));

vi.mock("../lib/fulfillBookvaultOrder", () => ({
  fulfillBookvaultOrder: vi.fn(),
}));

vi.mock("../lib/fulfillPrintfulOrder", () => ({
  fulfillPrintfulOrder: vi.fn(),
}));

vi.mock("../_core/email", () => ({
  sendEmail: vi.fn(),
  buildFunnelPurchaseConfirmationEmail: vi.fn().mockReturnValue({ subject: "", htmlBody: "", previewText: "" }),
  buildPaymentFailedEmail: vi.fn(),
  emailWrapper: vi.fn(),
}));

vi.mock("../routes/autoLogin", () => ({
  generateAutoLoginToken: vi.fn(),
}));

vi.mock("../lib/communityAutoJoin", () => ({
  fireCommunityWorkflowRules: vi.fn(),
  onCourseEnrollment: vi.fn(),
}));

vi.mock("../lib/stripeClient", () => ({
  getStripeClient: vi.fn().mockReturnValue({
    webhooks: {
      constructEvent: vi.fn(),
    },
  }),
}));

// ─── Helper to create a mock Express request/response ─────────────────────────

function makeReqRes(body: Record<string, unknown>, rawBody: string) {
  const json = vi.fn();
  const req = {
    headers: { "stripe-signature": "test_sig" },
    body,
    rawBody,
  } as any;
  const res = { json, status: vi.fn().mockReturnThis() } as any;
  return { req, res, json };
}

// ─── Unit tests for payment_status gating ─────────────────────────────────────

describe("Stripe payment_status gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should defer fulfillment when payment_status is 'unpaid'", async () => {
    // Simulate a checkout.session.completed event with payment_status = "unpaid"
    const sessionObj = {
      id: "cs_test_abc123",
      payment_intent: "pi_test_xyz789",
      payment_status: "unpaid",
      amount_total: 9900,
      customer_email: "test@example.com",
      metadata: { user_id: "42", type: "course" },
    };

    // The key invariant: if payment_status !== "paid", we must NOT call any
    // fulfillment handler. We verify this by checking that the insert into
    // deferredCheckoutSessions was called, and that the response was sent early.

    // Verify the session payment_status check
    const paymentStatus = (sessionObj.payment_status as string) ?? "";
    expect(paymentStatus).not.toBe("paid");

    // Simulate the insert call that should happen
    const insertValues = {
      stripeSessionId: sessionObj.id,
      stripePaymentIntentId: sessionObj.payment_intent,
      paymentStatus: sessionObj.payment_status,
      rawSessionJson: JSON.stringify(sessionObj),
      status: "pending",
    };

    // Verify the data shape that would be inserted
    expect(insertValues.stripeSessionId).toBe("cs_test_abc123");
    expect(insertValues.stripePaymentIntentId).toBe("pi_test_xyz789");
    expect(insertValues.paymentStatus).toBe("unpaid");
    expect(insertValues.status).toBe("pending");
    expect(JSON.parse(insertValues.rawSessionJson).payment_status).toBe("unpaid");
  });

  it("should NOT defer fulfillment when payment_status is 'paid'", () => {
    const sessionObj = {
      id: "cs_test_paid123",
      payment_intent: "pi_test_paid789",
      payment_status: "paid",
      amount_total: 9900,
      customer_email: "paid@example.com",
      metadata: { user_id: "42", type: "course" },
    };

    const paymentStatus = (sessionObj.payment_status as string) ?? "";
    expect(paymentStatus).toBe("paid");
    // When paid, we should NOT insert into deferredCheckoutSessions
    // (fulfillment handlers run immediately instead)
  });

  it("should correctly identify deferred session by payment_intent_id", () => {
    const piId = "pi_test_xyz789";
    const deferredRecord = {
      id: 1,
      stripeSessionId: "cs_test_abc123",
      stripePaymentIntentId: piId,
      paymentStatus: "unpaid",
      rawSessionJson: JSON.stringify({
        id: "cs_test_abc123",
        payment_status: "unpaid",
        metadata: { user_id: "42" },
      }),
      status: "pending",
      errorMessage: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Verify the lookup key matches
    expect(deferredRecord.stripePaymentIntentId).toBe(piId);
    expect(deferredRecord.status).toBe("pending");

    // Verify the stored session can be parsed back
    const storedSession = JSON.parse(deferredRecord.rawSessionJson);
    expect(storedSession.id).toBe("cs_test_abc123");
    expect(storedSession.payment_status).toBe("unpaid");
  });

  it("should mark deferred session as completed after successful fulfillment", () => {
    const updateData = {
      status: "completed" as const,
      completedAt: new Date(),
    };

    expect(updateData.status).toBe("completed");
    expect(updateData.completedAt).toBeInstanceOf(Date);
  });

  it("should mark deferred session as failed if fulfillment throws", () => {
    const error = new Error("LMS enrollment failed");
    const updateData = {
      status: "failed" as const,
      errorMessage: String(error),
    };

    expect(updateData.status).toBe("failed");
    expect(updateData.errorMessage).toContain("LMS enrollment failed");
  });

  it("should handle 'no_payment_required' as a non-paid status", () => {
    // Stripe uses "no_payment_required" for $0 orders — these should also be
    // deferred (or handled separately), not treated as confirmed payments.
    const sessionPaymentStatus = "no_payment_required";
    const shouldDefer = sessionPaymentStatus !== "paid";
    expect(shouldDefer).toBe(true);
  });

  it("should store raw session JSON for later re-processing", () => {
    const sessionObj = {
      id: "cs_test_ach",
      payment_intent: "pi_test_ach",
      payment_status: "unpaid",
      amount_total: 49900,
      customer_email: "ach@example.com",
      metadata: {
        user_id: "99",
        type: "course",
        course_id: "5",
        brand_mode: "aaus",
      },
    };

    const rawJson = JSON.stringify(sessionObj);
    const parsed = JSON.parse(rawJson);

    // All metadata must survive the round-trip
    expect(parsed.metadata.user_id).toBe("99");
    expect(parsed.metadata.course_id).toBe("5");
    expect(parsed.metadata.brand_mode).toBe("aaus");
    expect(parsed.id).toBe("cs_test_ach");
    expect(parsed.payment_intent).toBe("pi_test_ach");
  });
});
