import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock("./db", () => ({
  getDb,
  getUserByEmail: vi.fn(),
  getOrCreateUserByEmail: vi.fn(),
  getOrCreateAccessToken: vi.fn(),
}));

import { handleWebinarCheckoutCompleted } from "./webhooks/stripe";

function queryResult(value: unknown) {
  return {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(value),
      }),
    }),
  };
}

describe("paid webinar checkout fulfillment", () => {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const paidPresaleSession = {
    id: "cs_paid_webinar_1",
    payment_intent: "pi_paid_webinar_1",
    metadata: { type: "webinar", webinar_id: "71", user_id: "42" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a restricted registration for a paid Pre-sale webinar without needing the return page", async () => {
    const select = vi.fn()
      .mockReturnValueOnce(queryResult([]))
      .mockReturnValueOnce(queryResult([{ status: "presale" }]));
    const db = { select, insert: vi.fn(() => ({ values: insertValues })) };
    getDb.mockResolvedValue(db);

    await handleWebinarCheckoutCompleted(paidPresaleSession);

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      webinarId: 71,
      userId: 42,
      stripePaymentIntentId: "pi_paid_webinar_1",
      accessLevel: "presale",
    }));
  });

  it("is idempotent when webhook delivery is repeated", async () => {
    const select = vi.fn().mockReturnValueOnce(queryResult([{ id: 9 }]));
    const db = { select, insert: vi.fn(() => ({ values: insertValues })) };
    getDb.mockResolvedValue(db);

    await handleWebinarCheckoutCompleted(paidPresaleSession);

    expect(db.insert).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("grants full access for a paid webinar that is already open", async () => {
    const select = vi.fn()
      .mockReturnValueOnce(queryResult([]))
      .mockReturnValueOnce(queryResult([{ status: "published" }]));
    const db = { select, insert: vi.fn(() => ({ values: insertValues })) };
    getDb.mockResolvedValue(db);

    await handleWebinarCheckoutCompleted(paidPresaleSession);

    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ accessLevel: "full" }));
  });
});
