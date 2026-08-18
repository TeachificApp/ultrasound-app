import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const { getDbMock, stripeCheckoutCreateMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  stripeCheckoutCreateMock: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: getDbMock }));
vi.mock("./lib/stripeClient", () => ({
  getStripeClient: () => ({ checkout: { sessions: { create: stripeCheckoutCreateMock } } }),
}));
vi.mock("./lib/orderBumpCheckout", () => ({ buildOrderBumpCheckoutLine: vi.fn().mockResolvedValue(null) }));

import { downloadsLearnerRouter } from "./routers/downloadsRouter";

function createDb() {
  let selectCall = 0;
  return {
    select: vi.fn(() => {
      selectCall += 1;
      const result = selectCall === 1
        ? [{ id: 31, title: "Ultrasound Workbook", slug: "ultrasound-workbook", status: "published", bundleOnly: false, isFree: false, price: "299.97", currency: "usd", subtitle: null, thumbnailUrl: null }]
        : [];
      return { from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue(result) })) })) };
    }),
  };
}

function makeContext(): TrpcContext {
  return {
    user: null,
    req: { headers: { origin: "https://learn.allaboutultrasound.com", host: "learn.allaboutultrasound.com" } } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("downloads.createCheckout Stripe payload", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    stripeCheckoutCreateMock.mockReset();
    stripeCheckoutCreateMock.mockResolvedValue({ url: "https://checkout.stripe.test/download" });
  });

  it("sends a $299.97 download to Stripe as exactly 29,997 cents", async () => {
    getDbMock.mockResolvedValue(createDb());
    const caller = downloadsLearnerRouter.createCaller(makeContext());
    await caller.createCheckout({ productId: 31 });

    const [payload] = stripeCheckoutCreateMock.mock.calls[0];
    expect(payload.line_items[0].price_data).toMatchObject({ currency: "usd", unit_amount: 29997 });
  });
});
