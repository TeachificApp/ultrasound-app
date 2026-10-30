import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const { getDbMock, stripeCheckoutCreateMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  stripeCheckoutCreateMock: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: getDbMock, getUserByEmail: vi.fn() }));
vi.mock("./lib/stripeClient", () => ({
  getStripeClient: () => ({ checkout: { sessions: { create: stripeCheckoutCreateMock } } }),
}));
vi.mock("./lib/orderBumpCheckout", () => ({ buildOrderBumpCheckoutLine: vi.fn().mockResolvedValue(null) }));

import {
  assertPaidDownloadCheckoutPrice,
  downloadsLearnerRouter,
  getPaidDownloadCheckoutCents,
  MINIMUM_PAID_DOWNLOAD_CHECKOUT_CENTS,
} from "./routers/downloadsRouter";

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

function createUnpricedDownloadDb() {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{
            id: 32,
            title: "Unpriced Download",
            slug: "unpriced-download",
            status: "published",
            bundleOnly: false,
            isFree: false,
            price: "0.00",
            currency: "usd",
            subtitle: null,
            thumbnailUrl: null,
          }]),
        })),
      })),
    })),
  };
}

function createPaidEmbeddedDownloadDb() {
  let selectCall = 0;
  return {
    select: vi.fn(() => {
      selectCall += 1;
      const result = selectCall === 1
        ? [{
          id: 33,
          title: "Configured Download",
          slug: "configured-download",
          status: "published",
          bundleOnly: false,
          isFree: false,
          price: "29.97",
          currency: "usd",
          subtitle: null,
          thumbnailUrl: null,
        }]
        : [{
          checkoutTermsText: null,
          checkoutTermsLinkText1: null,
          checkoutTermsLinkUrl1: null,
          checkoutTermsLinkText2: null,
          checkoutTermsLinkUrl2: null,
        }];
      const tableQuery = {
        where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue(result) })),
        limit: vi.fn().mockResolvedValue(result),
      };
      return { from: vi.fn(() => tableQuery) };
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

  it("rejects a paid download without a Stripe-valid configured amount before creating a session", () => {
    expect(getPaidDownloadCheckoutCents("0.00")).toBe(0);
    expect(MINIMUM_PAID_DOWNLOAD_CHECKOUT_CENTS).toBe(50);
    expect(() => assertPaidDownloadCheckoutPrice("0.00")).toThrow(/checkout price has not been configured/i);
    expect(() => assertPaidDownloadCheckoutPrice("0.49")).toThrow(/checkout price has not been configured/i);
    expect(assertPaidDownloadCheckoutPrice("0.50")).toBe(50);
  });

  it("does not call Stripe when guest embedded checkout finds an unpriced paid download", async () => {
    getDbMock.mockResolvedValue(createUnpricedDownloadDb());
    const caller = downloadsLearnerRouter.createCaller(makeContext());

    await expect(caller.createEmbeddedCheckoutSession({
      productSlug: "unpriced-download",
      origin: "https://learn.allaboutultrasound.com",
      payerEmail: "payer@example.test",
      recipientEmail: "learner@example.test",
    })).rejects.toThrow(/checkout price has not been configured/i);

    expect(stripeCheckoutCreateMock).not.toHaveBeenCalled();
  });

  it("creates a guest embedded session for a configured paid download", async () => {
    getDbMock.mockResolvedValue(createPaidEmbeddedDownloadDb());
    stripeCheckoutCreateMock.mockResolvedValue({ client_secret: "cs_test_embedded_download" });
    const caller = downloadsLearnerRouter.createCaller(makeContext());

    const result = await caller.createEmbeddedCheckoutSession({
      productSlug: "configured-download",
      origin: "https://learn.allaboutultrasound.com",
      payerEmail: "payer@example.test",
    });

    expect(result.clientSecret).toBe("cs_test_embedded_download");
    expect(result.displayPrice).toBe(29.97);
    const [payload] = stripeCheckoutCreateMock.mock.calls[0];
    expect(payload.line_items[0].price_data.unit_amount).toBe(2997);
  });
});
