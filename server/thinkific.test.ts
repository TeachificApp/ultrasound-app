/**
 * Thinkific API integration test — validates the API key and subdomain are working.
 * Live API tests are skipped when THINKIFIC_API_KEY is not set in the environment.
 */
import { describe, it, expect } from "vitest";
import { getVisibleProducts, parseCreditHoursFromName, ULTRASOUNDASSIST_PREMIUM_PRODUCT_ID, FREE_MEMBERSHIP_COURSE_IDS } from "./thinkific";

const hasThinkificCreds = !!(process.env.THINKIFIC_API_KEY && process.env.THINKIFIC_SUBDOMAIN);

describe("Thinkific API", () => {
  it("should fetch visible products successfully", async () => {
    if (!hasThinkificCreds) {
      console.warn("[Thinkific] Skipping live API test — THINKIFIC_API_KEY not set");
      return;
    }
    const products = await getVisibleProducts();
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
    // All returned products should be published and not hidden
    for (const p of products) {
      expect(p.status).toBe("published");
      expect(p.hidden).toBe(false);
      expect(p.name.toUpperCase().startsWith("ARCHIVE")).toBe(false);
    }
  }, 30_000);

  it("should parse SDMS credit hours from course names", () => {
    expect(parseCreditHoursFromName("All About Venous Insufficiency - 2 SDMS CME")).toEqual({
      hours: "2",
      type: "SDMS",
    });
    expect(parseCreditHoursFromName("All About Upper Extremity Duplex - 2.5 SDMS CME")).toEqual({
      hours: "2.5",
      type: "SDMS",
    });
    expect(parseCreditHoursFromName("All About Sonographer Ergonomics - 1 SDMS FREE CME")).toEqual({
      hours: "1",
      type: "SDMS",
    });
    expect(parseCreditHoursFromName("Registry Review Quiz - No Credits")).toBeNull();
  });

  it("should return null for unknown user email", async () => {
    if (!hasThinkificCreds) {
      console.warn("[Thinkific] Skipping live API test — THINKIFIC_API_KEY not set");
      return;
    }
    const { getUserByEmail } = await import("./thinkific");
    const result = await getUserByEmail("nonexistent-user-xyz-12345@nowhere.invalid");
    expect(result).toBeNull();
  }, 15_000);

  it("AAUS premium product ID is correct", () => {
    expect(ULTRASOUNDASSIST_PREMIUM_PRODUCT_ID).toBe(3714929);
  });

  it("AAUS free membership course IDs include the free bundle", () => {
    expect(FREE_MEMBERSHIP_COURSE_IDS).toContain(3714918);
  });
});
