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

import { productsLearnerRouter } from "./routers/productsRouter";

function createDb() {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{
            id: 61,
            title: "Ultrasound Probe Trainer",
            slug: "ultrasound-probe-trainer",
            status: "published",
            checkoutMode: "native",
            isFree: false,
            price: "97.00",
            currency: "usd",
            subtitle: null,
            thumbnailUrl: null,
            shippingCountries: JSON.stringify(["US", "CA"]),
          }]),
        })),
      })),
    })),
  };
}

function makeContext(): TrpcContext {
  return {
    user: null,
    req: { headers: { origin: "https://learn.allaboutultrasound.com", host: "learn.allaboutultrasound.com" } } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("products.createCheckout Stripe payload", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    stripeCheckoutCreateMock.mockReset();
    stripeCheckoutCreateMock.mockResolvedValue({ url: "https://checkout.stripe.test/product" });
  });

  it("sends a $97.00 physical product as 9,700 cents and requests its configured shipping countries", async () => {
    getDbMock.mockResolvedValue(createDb());
    const caller = productsLearnerRouter.createCaller(makeContext());
    await caller.createCheckout({ productId: 61 });

    const [payload] = stripeCheckoutCreateMock.mock.calls[0];
    expect(payload.line_items[0].price_data).toMatchObject({ currency: "usd", unit_amount: 9700 });
    expect(payload.shipping_address_collection.allowed_countries).toEqual(["US", "CA"]);
  });
});
