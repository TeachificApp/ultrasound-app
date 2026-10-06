import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./routers/widgetRouter.ts", import.meta.url), "utf8");
const managerSource = readFileSync(new URL("../client/src/pages/admin/WidgetManager.tsx", import.meta.url), "utf8");

describe("canonical bundle embed widgets", () => {
  it("uses the active bundles catalog in the administrator picker", () => {
    expect(routerSource).toContain("bundles, bundlePricingOptions");
    expect(routerSource).toContain(".from(bundles).orderBy(asc(bundles.title))");
    expect(routerSource).toContain("...shape(bundleRows, \"bundle\", \"coverImage\")");
    expect(routerSource).not.toContain(".from(digitalBundles)");
  });

  it("keeps public cards limited to published bundles with correctly normalized prices", () => {
    expect(routerSource).toContain('eq(bundles.status, "published")');
    expect(routerSource).toContain("price: priceCents / 100");
    expect(routerSource).toContain("eq(bundlePricingOptions.isActive, true)");
  });

  it("tells administrators why a selected draft bundle is not public yet", () => {
    expect(managerSource).toContain("Draft — publish before visitor display");
    expect(managerSource).toContain("They will appear to visitors only after the bundle is published.");
  });
});
