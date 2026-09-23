import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildPaymentTimeRevenueShareCheckoutOptions,
  buildPaymentTimeRevenueShareMetadata,
} from "./lib/revenueShareEngine";

describe("revenue share assignment resolution", () => {
  it("prefers course-specific assignments over global assignments in engine source", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./lib/revenueShareEngine.ts", import.meta.url)),
      "utf8",
    );
    expect(source).toContain("fetchActiveAssignmentsForCourse");
    expect(source).toContain("if (courseSpecific.length > 0) return courseSpecific");
  });

  it("builds checkout metadata and destination transfer options for payment-time splits", () => {
    const share = {
      partnerId: 7,
      assignmentId: 12,
      stripeAccountId: "acct_test_partner",
      shareAmountCents: 749,
      sharePercentage: 25,
    };
    expect(buildPaymentTimeRevenueShareMetadata(share)).toEqual({
      revenue_share_payment_time: "true",
      revenue_share_partner_id: "7",
      revenue_share_assignment_id: "12",
      revenue_share_amount_cents: "749",
      revenue_share_percentage: "25",
    });
    const options = buildPaymentTimeRevenueShareCheckoutOptions(share);
    expect(options.metadata.revenue_share_payment_time).toBe("true");
    expect(options.paymentIntentData).toEqual({
      transfer_data: { destination: "acct_test_partner", amount: 749 },
      metadata: options.metadata,
    });
  });

  it("keeps the admin reconciliation path ledger-only and idempotent", () => {
    const routerSource = readFileSync(
      fileURLToPath(new URL("./routers/revenueShareRouter.ts", import.meta.url)),
      "utf8",
    );
    const start = routerSource.indexOf("reconcilePaidCourseSales");
    const end = routerSource.indexOf("// ── Admin: List assignments", start);
    const reconciliationSource = routerSource.slice(start, end);
    expect(reconciliationSource).toContain("revenueShareLedger");
    expect(reconciliationSource).toContain("skippedExisting");
    expect(reconciliationSource).toContain('status: "pending"');
    expect(reconciliationSource).not.toContain("stripe.transfers.create");
  });

  it("exposes a refresh control for stored Stripe onboarding statuses", () => {
    const routerSource = readFileSync(
      fileURLToPath(new URL("./routers/revenueShareRouter.ts", import.meta.url)),
      "utf8",
    );
    const adminSource = readFileSync(
      fileURLToPath(new URL("../client/src/pages/admin/RevenueShareAdmin.tsx", import.meta.url)),
      "utf8",
    );
    expect(routerSource).toContain("refreshAllPartnerStatuses");
    expect(adminSource).toContain("Refresh Stripe Statuses");
    expect(adminSource).toContain("Reconcile Paid Course Sales");
  });
});
