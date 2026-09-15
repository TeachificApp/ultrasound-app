import { describe, expect, it } from "vitest";
import {
  calculateShareAmountCents,
  canManualProcessLedgerEntry,
  isAutoProcessedLedgerEntry,
} from "./lib/revenueShareEngine";

describe("revenue share manual processing guards", () => {
  it("calculates share amount from gross and percentage", () => {
    expect(calculateShareAmountCents(2997, 25)).toBe(749);
    expect(calculateShareAmountCents(10000, 30)).toBe(3000);
  });

  it("detects auto-processed ledger entries", () => {
    expect(isAutoProcessedLedgerEntry({ status: "paid", processMethod: "payment_time" })).toBe(true);
    expect(isAutoProcessedLedgerEntry({ status: "paid", processMethod: "stripe_transfer" })).toBe(true);
    expect(isAutoProcessedLedgerEntry({ status: "paid", processMethod: "manual" })).toBe(false);
    expect(isAutoProcessedLedgerEntry({ status: "paid", processMethod: null })).toBe(true);
    expect(isAutoProcessedLedgerEntry({ status: "pending", processMethod: null })).toBe(false);
  });

  it("blocks reprocessing payment-time and auto-paid entries", () => {
    expect(canManualProcessLedgerEntry({ status: "paid", processMethod: "payment_time", autoProcessedAt: 1 }).allowed).toBe(false);
    expect(canManualProcessLedgerEntry({ status: "paid", processMethod: "stripe_transfer", autoProcessedAt: 1 }).allowed).toBe(false);
    expect(canManualProcessLedgerEntry({ status: "paid", processMethod: "manual" }).allowed).toBe(false);
  });

  it("allows manual processing for pending and failed entries", () => {
    expect(canManualProcessLedgerEntry({ status: "pending", processMethod: null }).allowed).toBe(true);
    expect(canManualProcessLedgerEntry({ status: "failed", processMethod: null }).allowed).toBe(true);
    expect(canManualProcessLedgerEntry({ status: "processing", processMethod: null }).allowed).toBe(false);
  });
});
