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

  it("requires a selected scheduled instance for a workshop confirmation preview", () => {
    const source = readFileSync("client/src/components/admin/PurchaseEmailOverrides.tsx", "utf8");
    expect(source).toContain('id="workshop-email-preview-instance"');
    expect(source).toContain("Workshop instance for preview");
    expect(source).toContain("selectedWorkshopInstance");
    expect(source).toContain('item.source === "workshop_instance" && item.workshopId === selected.id');
    expect(source).toContain('const previewTarget = selected.source === "workshop" ? selectedWorkshopInstance : selected');
  });

  it("keeps available content visible when one optional catalog source cannot load", () => {
    const router = readFileSync("server/routers/purchaseEmailOverridesRouter.ts", "utf8");
    const screen = readFileSync("client/src/components/admin/PurchaseEmailOverrides.tsx", "utf8");

    expect(router).toContain("const unavailableSources: string[] = []");
    expect(router).toContain("const readCatalog = async");
    expect(router).toContain('readCatalog("workshops"');
    expect(router).toContain("unavailableSources");
    expect(screen).toContain('refetchOnMount: "always"');
    expect(screen).toContain("Content catalog could not load");
    expect(screen).toContain("Some content is temporarily unavailable in this list:");
  });
});
