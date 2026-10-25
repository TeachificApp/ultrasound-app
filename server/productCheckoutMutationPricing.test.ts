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

function createPaidEmbeddedProductDb() {
  let selectCall = 0;
  return {
    select: vi.fn(() => {
      selectCall += 1;
      const result = selectCall === 1
        ? [{
            id: 62,
            title: "Configured Physical Product",
            slug: "configured-physical-product",
            status: "published",
            checkoutMode: "native",
            isFree: false,
            price: "97.00",
            currency: "usd",
            subtitle: null,
            thumbnailUrl: null,
            requiresShipping: true,
          }]
        : [{
            checkoutTermsText: null,
            checkoutTermsLinkText1: null,
            checkoutTermsLinkUrl1: null,
            checkoutTermsLinkText2: null,
            checkoutTermsLinkUrl2: null,
            termsUrl: null,
            privacyUrl: null,
          }];
      const query = {
        where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue(result) })),
        limit: vi.fn().mockResolvedValue(result),
      };
      return { from: vi.fn(() => query) };
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

  it("creates a guest embedded physical checkout session with shipping collection", async () => {
    getDbMock.mockResolvedValue(createPaidEmbeddedProductDb());
    stripeCheckoutCreateMock.mockResolvedValue({ client_secret: "cs_test_embedded_physical" });
    const caller = productsLearnerRouter.createCaller(makeContext());

    const result = await caller.createEmbeddedCheckoutSession({
      productSlug: "configured-physical-product",
      origin: "https://learn.allaboutultrasound.com",
    });

    expect(result.clientSecret).toBe("cs_test_embedded_physical");
    expect(result.free).toBe(false);
    const [payload] = stripeCheckoutCreateMock.mock.calls[0];
    expect(payload.line_items[0].price_data.unit_amount).toBe(9700);
    expect(payload.shipping_address_collection.allowed_countries).toEqual(["US", "CA", "AU", "GB"]);
  });
});
