import { describe, expect, it } from "vitest";
import { matchRoute } from "wouter";
import { parse } from "regexparam";

const parser = (route: string, loose?: boolean) => parse(route, loose);

describe("wouter route precedence for blank-page paths", () => {
  it("prefers explicit /admin/funnels over catch-alls", () => {
    const path = "/admin/funnels";
    const routes = ["/admin/funnels", "/admin/:rest*", "/:slug/:pageSlug"];
    const first = routes.find((r) => matchRoute(parser, r, path)[0]);
    expect(first).toBe("/admin/funnels");
  });

  it("matches funnel pages on /:slug/:pageSlug", () => {
    const path = "/sonographer-to-ceo-ultrasound-business-blueprint/quick-guide";
    expect(matchRoute(parser, "/:slug/:pageSlug", path)[0]).toBe(true);
    expect(matchRoute(parser, "/:slug", path)[0]).toBe(false);
  });

  it("treats Switch children without path as catch-all *", () => {
    const path = "/admin/funnels";
    // Wrapper components used as direct Switch children have no path → match everything.
    expect(matchRoute(parser, undefined as unknown as string, path)[0]).toBe(true);
  });
});
