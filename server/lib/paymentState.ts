/**
 * Shared payment-state rules for transaction history and money aggregates.
 *
 * A record can represent fulfillment/access without being a monetary payment.
 * This helper deliberately treats only confirmed, non-zero payments as financial
 * transactions. It is not an entitlement or fulfillment policy.
 */
export type PaymentTransactionSource =
  | "funnel"
  | "course"
  | "download"
  | "bundle"
  | "physical"
  | "workshop"
  | "webinar"
  | "manual_invoice";

export type PaymentTransactionCandidate = {
  sourceTable: PaymentTransactionSource;
  status: string;
  amountPaid: number;
  purchasedAt?: Date;
  hasStripeReference?: boolean;
};

const ABANDONED_UNLINKED_CHECKOUT_AFTER_MS = 24 * 60 * 60 * 1000;

/** Returns true only for a completed, monetary payment that belongs in money/count totals. */
export function countsAsCompletedPayment(transaction: PaymentTransactionCandidate): boolean {
  if (!Number.isFinite(transaction.amountPaid) || transaction.amountPaid <= 0) return false;

  switch (transaction.sourceTable) {
    case "funnel":
    case "course":
    case "bundle":
    case "webinar":
    case "manual_invoice":
      return transaction.status === "paid";
    case "download":
      // Open is the active fulfilled entitlement state for a paid download.
      return transaction.status === "open";
    case "physical":
      // Physical-order status is fulfillment state, not payment state. A stored
      // payment intent is established at webhook fulfillment before this row exists.
      return !["cancelled", "refunded"].includes(transaction.status);
    case "workshop":
      return transaction.status === "active";
    default:
      return false;
  }
}

export function summarizeCompletedPayments(transactions: PaymentTransactionCandidate[]): {
  total: number;
  totalSpent: number;
} {
  const completedTransactions = transactions.filter(countsAsCompletedPayment);
  return {
    total: completedTransactions.length,
    totalSpent: completedTransactions.reduce((sum, transaction) => sum + transaction.amountPaid, 0),
  };
}

/**
 * Course orders are created provisionally before Stripe Checkout is launched.
 * A failed provisional order is retained for authorized audit history but must
 * never be represented as a payment.
 */
export function getAdministratorTransactionStatus(transaction: PaymentTransactionCandidate): string {
  if (transaction.sourceTable === "course" && transaction.status === "failed") {
    return "abandoned";
  }
  if (
    transaction.sourceTable === "course" &&
    transaction.status === "pending" &&
    transaction.hasStripeReference === false &&
    transaction.purchasedAt instanceof Date &&
    transaction.purchasedAt.getTime() <= Date.now() - ABANDONED_UNLINKED_CHECKOUT_AFTER_MS
  ) {
    return "abandoned";
  }
  return transaction.status;
}

/** Standardize provisional LMS order storage with all checkout paths in cents. */
export function toCheckoutAmountCents(amount: number): number {
  return Math.round(Number(amount) * 100);
}
