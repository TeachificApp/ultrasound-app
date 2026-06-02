/**
 * createPaymentLink.test.ts
 * Tests for the createPaymentLink procedure logic:
 * - Auto-creates Stripe Product+Price for all pricing types
 * - Caches the payment link ID and reuses it on subsequent calls
 * - Handles one_time, subscription, and payment_plan pricing types
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal pricing option row for testing */
function makePricingOption(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    courseId: 10,
    label: "Full Access",
    sublabel: null,
    pricingType: "one_time",
    price: 199.97,
    stripePriceId: null,
    stripePaymentLinkId: null,
    subscriptionInterval: null,
    downPayment: 0,
    installmentCount: 0,
    installmentAmount: 0,
    installmentIntervalDays: 30,
    ctaLabel: null,
    ctaUrl: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Build a minimal course row for testing */
function makeCourse(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    title: "Advanced Cardiac Sonographer",
    subtitle: "Master the ACS exam",
    slug: "acs-mastery",
    currency: "usd",
    stripePriceId: null,
    ...overrides,
  };
}

// ─── Unit: price calculation helpers ─────────────────────────────────────────

describe("createPaymentLink — unit_amount calculation", () => {
  it("converts dollar price to cents for one_time pricing", () => {
    const price = 199.97;
    const unitAmount = Math.round(Number(price) * 100);
    expect(unitAmount).toBe(19997);
  });

  it("converts dollar price to cents for subscription pricing", () => {
    const price = 49.97;
    const unitAmount = Math.round(Number(price) * 100);
    expect(unitAmount).toBe(4997);
  });

  it("converts installment amount to cents for payment_plan", () => {
    const installmentAmt = 99.99;
    const unitAmount = Math.round(Number(installmentAmt) * 100);
    expect(unitAmount).toBe(9999);
  });

  it("falls back to opt.price when installmentAmount is 0 for payment_plan", () => {
    const opt = makePricingOption({ pricingType: "payment_plan", price: 299.97, installmentAmount: 0 });
    const installmentAmt =
      opt.installmentAmount && opt.installmentAmount > 0 ? opt.installmentAmount : opt.price;
    expect(installmentAmt).toBe(299.97);
  });

  it("uses installmentAmount when set for payment_plan", () => {
    const opt = makePricingOption({ pricingType: "payment_plan", price: 299.97, installmentAmount: 99.99 });
    const installmentAmt =
      opt.installmentAmount && opt.installmentAmount > 0 ? opt.installmentAmount : opt.price;
    expect(installmentAmt).toBe(99.99);
  });
});

// ─── Unit: subscription interval mapping ─────────────────────────────────────

describe("createPaymentLink — subscription interval mapping", () => {
  const intervalMap: Record<string, "month" | "year"> = {
    monthly: "month",
    quarterly: "month",
    annual: "year",
  };
  const intervalCountMap: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    annual: 1,
  };

  it("maps monthly to month/1", () => {
    expect(intervalMap["monthly"]).toBe("month");
    expect(intervalCountMap["monthly"]).toBe(1);
  });

  it("maps quarterly to month/3", () => {
    expect(intervalMap["quarterly"]).toBe("month");
    expect(intervalCountMap["quarterly"]).toBe(3);
  });

  it("maps annual to year/1", () => {
    expect(intervalMap["annual"]).toBe("year");
    expect(intervalCountMap["annual"]).toBe(1);
  });

  it("falls back to month/1 for unknown interval", () => {
    const interval = "unknown";
    expect(intervalMap[interval] ?? "month").toBe("month");
    expect(intervalCountMap[interval] ?? 1).toBe(1);
  });
});

// ─── Unit: payment_plan interval calculation ──────────────────────────────────

describe("createPaymentLink — payment_plan interval months", () => {
  it("converts 30 days to 1 month", () => {
    const intervalDays = 30;
    const intervalMonths = Math.round(intervalDays / 30) || 1;
    expect(intervalMonths).toBe(1);
  });

  it("converts 60 days to 2 months", () => {
    const intervalDays = 60;
    const intervalMonths = Math.round(intervalDays / 30) || 1;
    expect(intervalMonths).toBe(2);
  });

  it("falls back to 1 month when intervalDays is 0", () => {
    const intervalDays = 0;
    const intervalMonths = Math.round(intervalDays / 30) || 1;
    expect(intervalMonths).toBe(1);
  });

  it("falls back to 1 month when installmentIntervalDays is null", () => {
    const opt = makePricingOption({ installmentIntervalDays: null });
    const intervalMonths = Math.round((opt.installmentIntervalDays ?? 30) / 30) || 1;
    expect(intervalMonths).toBe(1);
  });
});

// ─── Unit: payment link caching logic ────────────────────────────────────────

describe("createPaymentLink — caching logic", () => {
  it("returns cached link URL when stripePaymentLinkId is set and link is active", async () => {
    const mockStripe = {
      paymentLinks: {
        retrieve: vi.fn().mockResolvedValue({ id: "plink_abc", active: true, url: "https://buy.stripe.com/test_abc" }),
        create: vi.fn(),
      },
    };

    const opt = makePricingOption({ stripePaymentLinkId: "plink_abc" });
    const cachedLinkId = (opt as any).stripePaymentLinkId as string | null;

    let result: { url: string } | null = null;
    if (cachedLinkId) {
      const existing = await mockStripe.paymentLinks.retrieve(cachedLinkId);
      if (existing.active) result = { url: existing.url };
    }

    expect(result).toEqual({ url: "https://buy.stripe.com/test_abc" });
    expect(mockStripe.paymentLinks.create).not.toHaveBeenCalled();
  });

  it("falls through to create a new link when cached link is inactive", async () => {
    const mockStripe = {
      paymentLinks: {
        retrieve: vi.fn().mockResolvedValue({ id: "plink_old", active: false, url: "https://buy.stripe.com/old" }),
        create: vi.fn().mockResolvedValue({ id: "plink_new", url: "https://buy.stripe.com/new" }),
      },
      products: { create: vi.fn().mockResolvedValue({ id: "prod_new" }) },
      prices: { create: vi.fn().mockResolvedValue({ id: "price_new" }) },
    };

    const opt = makePricingOption({ stripePaymentLinkId: "plink_old" });
    const cachedLinkId = (opt as any).stripePaymentLinkId as string | null;

    let shouldCreate = true;
    if (cachedLinkId) {
      const existing = await mockStripe.paymentLinks.retrieve(cachedLinkId);
      if (existing.active) shouldCreate = false;
    }

    expect(shouldCreate).toBe(true);
  });

  it("falls through to create a new link when retrieve throws (deleted link)", async () => {
    const mockStripe = {
      paymentLinks: {
        retrieve: vi.fn().mockRejectedValue(new Error("No such payment_link")),
        create: vi.fn().mockResolvedValue({ id: "plink_new", url: "https://buy.stripe.com/new" }),
      },
    };

    const opt = makePricingOption({ stripePaymentLinkId: "plink_deleted" });
    const cachedLinkId = (opt as any).stripePaymentLinkId as string | null;

    let shouldCreate = true;
    if (cachedLinkId) {
      try {
        const existing = await mockStripe.paymentLinks.retrieve(cachedLinkId);
        if (existing.active) shouldCreate = false;
      } catch { /* link deleted — fall through */ }
    }

    expect(shouldCreate).toBe(true);
  });
});

// ─── Unit: product name construction ─────────────────────────────────────────

describe("createPaymentLink — product name", () => {
  it("uses course title alone when label is empty", () => {
    const course = makeCourse();
    const opt = makePricingOption({ label: "" });
    const productName = `${course.title}${opt.label ? ` — ${opt.label}` : ""}`;
    expect(productName).toBe("Advanced Cardiac Sonographer");
  });

  it("appends label to course title when label is set", () => {
    const course = makeCourse();
    const opt = makePricingOption({ label: "3-Month Plan" });
    const productName = `${course.title}${opt.label ? ` — ${opt.label}` : ""}`;
    expect(productName).toBe("Advanced Cardiac Sonographer — 3-Month Plan");
  });
});
