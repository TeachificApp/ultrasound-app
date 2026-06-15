/**
 * orderBumpCheckout.test.ts
 *
 * Tests for the order bump fulfillment logic, specifically:
 *  - fulfillOrderBumpPurchase: correct fulfillment for webinar and membership bump types
 *  - idempotency: no double-registration or double-subscription
 *  - graceful handling of missing metadata
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock drizzle-orm helpers (used by the module under test) ─────────────────

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ _col, val })),
  and: vi.fn((...args: unknown[]) => args),
  isNull: vi.fn((col: unknown) => col),
  gt: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  sql: Object.assign(vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })), {
    raw: vi.fn((s: string) => s),
  }),
}));

// ─── Mock schema (tables are just empty objects; drizzle-orm handles the rest) ─

vi.mock("../../drizzle/schema", () => ({
  orderBumps: { id: "id" },
  lmsCourses: { id: "id" },
  digitalProducts: { id: "id" },
  digitalBundles: { id: "id" },
  digitalBundleItems: { bundleId: "bundleId", productId: "productId" },
  webinars: { id: "id" },
  membershipPlans: { id: "id" },
  webinarRegistrations: { id: "id", userId: "userId", webinarId: "webinarId" },
  membershipSubscriptions: { id: "id", userId: "userId", planId: "planId", status: "status" },
  lmsEnrollments: { id: "id", userId: "userId", courseId: "courseId", enrollmentType: "enrollmentType" },
  lmsOrders: { id: "id" },
  orderBumpConversions: { id: "id", bumpId: "bumpId", stripeCheckoutSessionId: "stripeCheckoutSessionId" },
  digitalPurchases: { id: "id", userId: "userId", productId: "productId" },
  digitalBundlePurchases: { id: "id", userId: "userId", bundleId: "bundleId" },
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { fulfillOrderBumpPurchase } from "./lib/orderBumpCheckout";

// ─── DB mock factory ──────────────────────────────────────────────────────────

/**
 * Build a minimal Drizzle-like DB mock.
 * `selectResponses` is a queue: each call to db.select() pops the next response.
 */
function buildDb(selectResponses: unknown[][]) {
  let callIndex = 0;
  const insertValuesMock = vi.fn().mockResolvedValue(undefined);
  const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock });
  const executeMock = vi.fn().mockResolvedValue(undefined);
  const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const updateMock = vi.fn().mockReturnValue({ set: updateSetMock });

  const selectMock = vi.fn().mockImplementation(() => {
    const rows = selectResponses[callIndex] ?? [];
    callIndex++;
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    };
  });

  return { db: { select: selectMock, insert: insertMock, update: updateMock, execute: executeMock }, insertMock, insertValuesMock, executeMock };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("fulfillOrderBumpPurchase — webinar bump type", () => {
  it("registers user for webinar when no existing registration", async () => {
    // select calls in order:
    //  1. check existing webinar registration → [] (none)
    //  2. check existing conversion → [] (none)
    const { db, insertMock, insertValuesMock } = buildDb([[], []]);

    await fulfillOrderBumpPurchase(
      db,
      {
        order_bump_id: "1",
        order_bump_product_id: "42",
        order_bump_type: "webinar",
        order_bump_price: "4900",
      },
      {
        userId: 99,
        sessionId: "cs_test_abc123",
        triggerOrderType: "course",
        triggerOrderId: 7,
      }
    );

    expect(insertMock).toHaveBeenCalled();
    // Find the webinar registration insert call
    const webinarInsert = insertValuesMock.mock.calls.find(
      (call) => call[0] && typeof call[0] === "object" && "webinarId" in call[0]
    );
    expect(webinarInsert).toBeDefined();
    expect(webinarInsert![0]).toMatchObject({ userId: 99, webinarId: 42 });
  });

  it("does not double-register when webinar registration already exists", async () => {
    // select calls:
    //  1. check existing webinar registration → [existing row]
    //  2. check existing conversion → []
    const { db, insertValuesMock } = buildDb([
      [{ id: 10, webinarId: 42, userId: 99 }],
      [],
    ]);

    await fulfillOrderBumpPurchase(
      db,
      {
        order_bump_id: "1",
        order_bump_product_id: "42",
        order_bump_type: "webinar",
        order_bump_price: "4900",
      },
      {
        userId: 99,
        sessionId: "cs_test_abc123",
        triggerOrderType: "course",
        triggerOrderId: 7,
      }
    );

    const webinarInserts = insertValuesMock.mock.calls.filter(
      (call) => call[0] && typeof call[0] === "object" && "webinarId" in call[0]
    );
    expect(webinarInserts).toHaveLength(0);
  });
});

describe("fulfillOrderBumpPurchase — membership bump type", () => {
  it("creates active membership subscription when no existing subscription", async () => {
    // select calls:
    //  1. check existing membership subscription → []
    //  2. check existing conversion → []
    const { db, insertMock, insertValuesMock } = buildDb([[], []]);

    await fulfillOrderBumpPurchase(
      db,
      {
        order_bump_id: "1",
        order_bump_product_id: "5",
        order_bump_type: "membership",
        order_bump_price: "9900",
      },
      {
        userId: 55,
        sessionId: "cs_test_xyz789",
        triggerOrderType: "download",
        triggerOrderId: 3,
      }
    );

    expect(insertMock).toHaveBeenCalled();
    const membershipInsert = insertValuesMock.mock.calls.find(
      (call) => call[0] && typeof call[0] === "object" && "planId" in call[0]
    );
    expect(membershipInsert).toBeDefined();
    expect(membershipInsert![0]).toMatchObject({ userId: 55, planId: 5, status: "active" });
  });

  it("does not double-create membership subscription when one already exists", async () => {
    // select calls:
    //  1. check existing membership subscription → [existing row]
    //  2. check existing conversion → []
    const { db, insertValuesMock } = buildDb([
      [{ id: 20, planId: 5, userId: 55, status: "active" }],
      [],
    ]);

    await fulfillOrderBumpPurchase(
      db,
      {
        order_bump_id: "1",
        order_bump_product_id: "5",
        order_bump_type: "membership",
        order_bump_price: "9900",
      },
      {
        userId: 55,
        sessionId: "cs_test_xyz789",
        triggerOrderType: "download",
        triggerOrderId: 3,
      }
    );

    const membershipInserts = insertValuesMock.mock.calls.filter(
      (call) => call[0] && typeof call[0] === "object" && "planId" in call[0]
    );
    expect(membershipInserts).toHaveLength(0);
  });
});

describe("fulfillOrderBumpPurchase — missing metadata", () => {
  it("returns early without error when order_bump_id is missing", async () => {
    const { db, insertMock } = buildDb([]);

    await expect(
      fulfillOrderBumpPurchase(db, {}, {
        userId: 1,
        sessionId: "cs_test_none",
        triggerOrderType: "course",
        triggerOrderId: 1,
      })
    ).resolves.toBeUndefined();

    // No inserts should happen
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns early without error when order_bump_type is missing", async () => {
    const { db, insertMock } = buildDb([]);

    await expect(
      fulfillOrderBumpPurchase(db, { order_bump_id: "5" }, {
        userId: 1,
        sessionId: "cs_test_none",
        triggerOrderType: "course",
        triggerOrderId: 1,
      })
    ).resolves.toBeUndefined();

    expect(insertMock).not.toHaveBeenCalled();
  });
});
