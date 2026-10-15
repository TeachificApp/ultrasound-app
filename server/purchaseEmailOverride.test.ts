import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applyPurchaseEmailOverride } from "./lib/purchaseEmailOverride";

describe("purchase email override copy", () => {
  const defaults = {
    subject: "Default subject",
    heading: "Default heading",
    intro: "Default intro",
    detailsHtml: "<p>Dynamic details</p>",
  };

  it("keeps the data-bound default template when no override is active", () => {
    expect(applyPurchaseEmailOverride(defaults, null)).toEqual(defaults);
  });

  it("replaces only populated copy fields and preserves dynamic defaults", () => {
    const copy = applyPurchaseEmailOverride(defaults, {
      contentType: "workshop_instance",
      contentId: 42,
      enabled: true,
      subject: "Updated subject",
      heading: "Updated heading",
      intro: "Updated opening",
      detailsHtml: null,
    });
    expect(copy).toEqual({
      subject: "Updated subject",
      heading: "Updated heading",
      intro: "Updated opening",
      detailsHtml: "<p>Dynamic details</p>",
    });
  });

  it("builds future workshop confirmations from the purchased instance fields", () => {
    const source = readFileSync("server/webhooks/stripe.ts", "utf8");
    const handler = source.slice(source.indexOf("async function handleWorkshopCheckoutCompleted"), source.indexOf("export async function handleWebinarCheckoutCompleted"));
    expect(handler).toContain("renderCurrentWorkshopSchedule(instance)");
    expect(handler).toContain('contentType: "workshop_instance"');
    expect(handler).not.toContain("isWorkshopConfirmationReady");
    expect(handler).not.toContain("confirmationEmailDetails");
  });

  it("offers one platform-admin override console without retrospective email sends", () => {
    const source = readFileSync("client/src/components/admin/PurchaseEmailOverrides.tsx", "utf8");
    expect(source).toContain("No retrospective sends");
    expect(source).toContain("saving, disabling, or reverting an override never sends or resends an email");
    expect(source).toContain("workshop_instance");
  });
});
