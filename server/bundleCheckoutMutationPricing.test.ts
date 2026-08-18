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

import { bundleLearnerRouter } from "./routers/bundleRouter";

function createDb() {
  let selectCall = 0;
  return {
    select: vi.fn(() => {
      selectCall += 1;
      if (selectCall === 1) return { from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([{ id: 17, title: "Clinical Bundle", slug: "clinical-bundle", status: "published", accessType: "paid", pricingOptions: null, collectShippingAddress: false }]) })) })) };
      return { from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue([{ id: 9, price: 19997, pricingType: "one_time", subscriptionInterval: null, stripePriceId: null }]) })) })) };
    }),
  };
}

function makeContext(): TrpcContext {
  return {
    user: null,
    req: { headers: { origin: "https://learn.allaboutultrasound.com" } } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("bundle.createCheckout Stripe payload", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    stripeCheckoutCreateMock.mockReset();
    stripeCheckoutCreateMock.mockResolvedValue({ url: "https://checkout.stripe.test/bundle" });
  });

  it("passes a structured 19,997-cent bundle option to Stripe without a second conversion", async () => {
    getDbMock.mockResolvedValue(createDb());
    const caller = bundleLearnerRouter.createCaller(makeContext());
    await caller.createCheckout({ bundleId: 17, pricingOptionId: "9" });

    const [payload] = stripeCheckoutCreateMock.mock.calls[0];
    expect(payload.line_items[0].price_data.unit_amount).toBe(19997);
    expect(payload.line_items[0].price_data.currency).toBe("usd");
  });
});
