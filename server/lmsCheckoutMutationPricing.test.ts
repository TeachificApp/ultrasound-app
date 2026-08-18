import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const { getDbMock, stripeCheckoutCreateMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  stripeCheckoutCreateMock: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: getDbMock,
  getOrCreateAccessToken: vi.fn(),
}));

vi.mock("./lib/stripeClient", () => ({
  getStripeClient: () => ({
    checkout: { sessions: { create: stripeCheckoutCreateMock } },
    prices: { retrieve: vi.fn() },
    products: { create: vi.fn() },
  }),
}));

vi.mock("./lib/orderBumpCheckout", () => ({
  buildOrderBumpCheckoutLine: vi.fn().mockResolvedValue(null),
}));

vi.mock("./lib/enrollmentAccess", () => ({
  getActiveEnrollment: vi.fn().mockResolvedValue(null),
}));

import { lmsLearnerRouter } from "./routers/lmsRouter";

function createDb(course: Record<string, unknown>) {
  const query = {
    limit: vi.fn().mockResolvedValue([course]),
  };
  return {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => query) })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ $returningId: vi.fn().mockResolvedValue([{ id: 701 }]) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
  };
}

function makeContext(): TrpcContext {
  return {
    user: {
      id: 91,
      openId: "lms-price-test",
      email: "learner@example.com",
      name: "Pricing Learner",
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("lms.createCheckout one-time price payload", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    stripeCheckoutCreateMock.mockReset();
    stripeCheckoutCreateMock.mockResolvedValue({ id: "cs_lms_pricing", url: "https://checkout.stripe.test/session" });
  });

  it("sends the authored $2,297.00 cohort-course offer as 229,700 cents through the real checkout mutation", async () => {
    getDbMock.mockResolvedValue(createDb({
      id: 44,
      slug: "adult-echo-cohort",
      title: "Adult Echocardiography Cohort",
      subtitle: null,
      status: "public",
      enrollmentCloseDate: null,
      pricingType: "one_time",
      price: "2297.00",
      isFree: false,
      currency: "usd",
      stripePriceId: null,
      downPayment: null,
      installmentAmount: null,
      installmentCount: null,
      installmentIntervalDays: null,
      subscriptionInterval: null,
      postPurchaseRedirectUrl: null,
      customThankYouEnabled: false,
    }));

    const caller = lmsLearnerRouter.createCaller(makeContext());
    await caller.createCheckout({
      courseSlug: "adult-echo-cohort",
      seats: 1,
      origin: "https://learn.allaboutultrasound.com",
    });

    expect(stripeCheckoutCreateMock).toHaveBeenCalledOnce();
    const [payload] = stripeCheckoutCreateMock.mock.calls[0];
    expect(payload.line_items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        quantity: 1,
        price_data: expect.objectContaining({ unit_amount: 229700, currency: "usd" }),
      }),
    ]));
  });
});
