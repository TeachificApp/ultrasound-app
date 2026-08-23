import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shouldRouteWorkshopCtaToCheckout } from "../shared/workshopPricing";

const publicLandingBlockSource = readFileSync(
  resolve(process.cwd(), "client/src/components/PublicLandingBlock.tsx"),
  "utf8",
);
const courseLandingSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/CourseLanding.tsx"),
  "utf8",
);
const blockPreviewSource = readFileSync(
  resolve(process.cwd(), "client/src/components/BlockPreview.tsx"),
  "utf8",
);

describe("course landing CTA wiring", () => {
  it("routes Save My Seat scroll_to_section labels to checkout", () => {
    expect(shouldRouteWorkshopCtaToCheckout("scroll_to_section", "Save My Seat")).toBe(true);
    expect(shouldRouteWorkshopCtaToCheckout("scroll_to_section", "View dates")).toBe(false);
  });

  it("PublicLandingBlock passes checkout handlers to BlockPreview", () => {
    expect(publicLandingBlockSource).toContain("onCheckoutPage={onCheckoutPage ?? onEnroll}");
    expect(publicLandingBlockSource).toContain("onEnroll={onEnroll}");
  });

  it("CourseLanding wires embedded cohort landing blocks to checkout", () => {
    expect(courseLandingSource).toContain("onCheckoutPage={onCheckoutPage ?? onEnroll}");
    expect(courseLandingSource).toContain('case "urgency_offer"');
    expect(courseLandingSource).toContain("return <TickerBlock data={d} />");
    expect(courseLandingSource).toContain("shouldRouteWorkshopCtaToCheckout");
  });

  it("BlockPreview urgency_offer uses live countdown when handlers are provided", () => {
    expect(blockPreviewSource).toContain("UrgencyOfferLiveBlock");
    expect(blockPreviewSource).toContain("computeCountdownV2EndTime");
  });
});
