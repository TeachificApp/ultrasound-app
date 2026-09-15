import { afterEach, describe, expect, it, vi } from "vitest";
import {
  countsAsCompletedPayment,
  getAdministratorTransactionStatus,
  summarizeCompletedPayments,
  toCheckoutAmountCents,
  type PaymentTransactionCandidate,
} from "./paymentState";

describe("payment-state policy", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("includes only completed monetary payments in member spend and transaction totals", () => {
    const transactions: PaymentTransactionCandidate[] = [
      { sourceTable: "course", status: "paid", amountPaid: 4_997 },
      { sourceTable: "course", status: "pending", amountPaid: 29_997, hasStripeReference: false },
      { sourceTable: "course", status: "failed", amountPaid: 29_997 },
      { sourceTable: "course", status: "refunded", amountPaid: 4_997 },
      { sourceTable: "download", status: "open", amountPaid: 700 },
      { sourceTable: "download", status: "refunded", amountPaid: 700 },
      { sourceTable: "workshop", status: "active", amountPaid: 2_500 },
      { sourceTable: "workshop", status: "refunded", amountPaid: 2_500 },
      { sourceTable: "manual_invoice", status: "paid", amountPaid: 0 },
    ];

    expect(summarizeCompletedPayments(transactions)).toEqual({
      total: 3,
      totalSpent: 8_197,
    });
  });

  it("never treats pending or deferred payment rows as completed payments", () => {
    expect(countsAsCompletedPayment({
      sourceTable: "course",
      status: "pending",
      amountPaid: 29_997,
      hasStripeReference: true,
    })).toBe(false);
    expect(countsAsCompletedPayment({
      sourceTable: "funnel",
      status: "pending",
      amountPaid: 2_997,
    })).toBe(false);
  });

  it("labels only stale unlinked provisional course orders as abandoned for administrators", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T16:00:00.000Z"));

    expect(getAdministratorTransactionStatus({
      sourceTable: "course",
      status: "pending",
      amountPaid: 29_997,
      hasStripeReference: false,
      purchasedAt: new Date("2026-07-24T13:04:29.000Z"),
    })).toBe("abandoned");

    expect(getAdministratorTransactionStatus({
      sourceTable: "course",
      status: "pending",
      amountPaid: 29_997,
      hasStripeReference: true,
      purchasedAt: new Date("2026-07-24T13:04:29.000Z"),
    })).toBe("pending");

    expect(getAdministratorTransactionStatus({
      sourceTable: "course",
      status: "pending",
      amountPaid: 29_997,
      hasStripeReference: false,
      purchasedAt: new Date("2026-09-15T15:59:00.000Z"),
    })).toBe("pending");
  });

  it("labels terminal failed provisional course orders as abandoned without treating them as payments", () => {
    const transaction: PaymentTransactionCandidate = {
      sourceTable: "course",
      status: "failed",
      amountPaid: 29_997,
    };

    expect(getAdministratorTransactionStatus(transaction)).toBe("abandoned");
    expect(countsAsCompletedPayment(transaction)).toBe(false);
  });

  it("stores checkout amounts in integer cents for both signed-in and guest checkout paths", () => {
    expect(toCheckoutAmountCents(29.97)).toBe(2_997);
    expect(toCheckoutAmountCents(99.975)).toBe(9_998);
  });
});
