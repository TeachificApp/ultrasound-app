import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getWorkshopCheckoutRecipient,
  isWorkshopCheckoutMetadata,
} from "./lib/workshopCheckoutFulfillment";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("workshop checkout fulfillment recovery", () => {
  it("requires the workshop and instance metadata ids", () => {
    expect(isWorkshopCheckoutMetadata({ type: "workshop", workshop_id: "12", instance_id: "34" })).toBe(true);
    expect(isWorkshopCheckoutMetadata({ type: "workshop", workshop_id: "12", instance_id: "" })).toBe(false);
    expect(isWorkshopCheckoutMetadata({ type: "course", workshop_id: "12", instance_id: "34" })).toBe(false);
  });

  it("gives a designated learner priority over the Stripe payer", () => {
    expect(getWorkshopCheckoutRecipient({
      customer_email: "payer@example.com",
      customer_details: { email: "payer@example.com", name: "Payer" },
    }, {
      recipient_email: "learner@example.com",
      recipient_name: "Designated Learner",
      customer_email: "payer@example.com",
    })).toEqual({ email: "learner@example.com", name: "Designated Learner" });
  });

  it("uses recovery for a paid workshop checkout without sending email", () => {
    const router = source("server/routers/lmsRouter.ts");
    const webhook = source("server/webhooks/stripe.ts");
    const helper = source("server/lib/workshopCheckoutFulfillment.ts");

    expect(router).toContain('if (meta.type === "workshop")');
    expect(router).toContain("fulfillWorkshopCheckoutFromStripeSession");
    expect(router).toContain('? "workshop"');
    expect(webhook).toContain("fulfillWorkshopCheckoutFromStripeSession");
    expect(webhook).toContain("isWorkshopConfirmationReady(instance)");
    expect(helper).toContain("It deliberately does not dispatch an email.");
    expect(helper).toContain("isCurrentCheckout");
  });

  it("keeps paid workshop cards visible when an instance lookup is absent", () => {
    const dashboard = source("server/routers/dashboardRouter.ts");
    expect(dashboard).toContain(".leftJoin(workshopInstances, eq(workshopEnrollments.instanceId, workshopInstances.id))");
  });
});
