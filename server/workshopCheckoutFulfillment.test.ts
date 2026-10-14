import { describe, expect, it } from "vitest";
import {
  isWorkshopCheckoutMetadata,
  resolveWorkshopCheckoutUserId,
} from "./lib/workshopCheckoutFulfillment";
import { readFileSync } from "node:fs";

describe("workshop checkout fulfillment", () => {
  it("detects workshop Stripe metadata", () => {
    expect(
      isWorkshopCheckoutMetadata({
        type: "workshop",
        workshop_id: "12",
        instance_id: "34",
      }),
    ).toBe(true);
    expect(isWorkshopCheckoutMetadata({ type: "course", course_id: "1" })).toBe(false);
  });

  it("resolves user id from client_reference_id when metadata user_id is empty", async () => {
    const userId = await resolveWorkshopCheckoutUserId({
      metadata: { type: "workshop", workshop_id: "1", instance_id: "2", user_id: "" },
      client_reference_id: "999",
    });
    expect(userId).toBe(999);
  });

  it("checkout session status includes workshop fallback fulfillment", () => {
    const lmsRouter = readFileSync(
      new URL("./routers/lmsRouter.ts", import.meta.url),
      "utf8",
    );
    expect(lmsRouter).toContain("fulfillWorkshopCheckoutFromStripeSession");
    expect(lmsRouter).toContain('meta.type === "workshop"');
  });

  it("workshop checkout metadata keeps type after revenue-share spreads", () => {
    const workshopRouter = readFileSync(
      new URL("./routers/workshopRouter.ts", import.meta.url),
      "utf8",
    );
    expect(workshopRouter).toContain('type: "workshop"');
    expect(workshopRouter).toContain("workshopShareMetadata");
  });
});
