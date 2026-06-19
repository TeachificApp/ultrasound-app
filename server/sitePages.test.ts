import { describe, it, expect } from "vitest";
import { validateSiteSlug } from "./lib/sitePageTree";
import { RESERVED_SITE_SLUGS, DEFAULT_SYSTEM_PAGES } from "../shared/sitePagesConstants";

describe("site pages", () => {
  it("rejects reserved slugs", () => {
    expect(validateSiteSlug("admin")).toMatch(/reserved/i);
    expect(validateSiteSlug("courses")).toMatch(/reserved/i);
  });

  it("accepts normal slugs", () => {
    expect(validateSiteSlug("about-us")).toBeNull();
  });

  it("seeds default system pages", () => {
    expect(DEFAULT_SYSTEM_PAGES.map((p) => p.slug)).toEqual(
      expect.arrayContaining(["privacy", "terms", "404", "login"]),
    );
  });

  it("reserves app routes", () => {
    expect(RESERVED_SITE_SLUGS.has("teach")).toBe(true);
    expect(RESERVED_SITE_SLUGS.has("api")).toBe(true);
  });
});
