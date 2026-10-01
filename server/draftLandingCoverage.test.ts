import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(
  new URL(path.startsWith("../") ? path : `./${path}`, import.meta.url),
  "utf8",
);

describe("draft landing access coverage", () => {
  it("uses the shared Platform Admin gate for every requested public landing type", () => {
    const publicLandingRouters = [
      "routers/lmsRouter.ts",
      "routers/productsRouter.ts",
      "routers/downloadsRouter.ts",
      "routers/workshopRouter.ts",
      "routers/webinarRouter.ts",
      "routers/funnelRouter.ts",
    ];

    for (const path of publicLandingRouters) {
      const source = readSource(path);
      expect(source, path).toContain("canPreviewDraftContent");
      expect(source, path).toContain("throwUnavailableDraftContent");
    }
  });

  it("protects supporting cohort and workshop data so draft content cannot be inferred", () => {
    const lmsSource = readSource("routers/lmsRouter.ts");
    const workshopSource = readSource("routers/workshopRouter.ts");

    expect(lmsSource).toMatch(/getCohortSeatAvailability[\s\S]*?canPreviewDraftContent/);
    expect(lmsSource).toMatch(/getCohortGroupSessions[\s\S]*?canPreviewDraftContent/);
    expect(workshopSource).toMatch(/getInstancesByIds[\s\S]*?canPreviewDraftContent/);
    expect(workshopSource).toMatch(/getSeatAvailability[\s\S]*?throwUnavailableDraftContent/);
  });

  it("renders friendly type-aware unavailable copy instead of raw API errors", () => {
    const source = readSource("../client/src/components/UnavailableContentPage.tsx");

    expect(source).toContain("currently unavailable");
    expect(source).toContain("We&apos;re working on updating this {label}. Please check back soon for availability.");
    expect(source).toContain('data-testid={`unavailable-${kind}-page`}');
  });
});
