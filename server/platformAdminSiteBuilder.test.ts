import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Platform Admin Site Builder card", () => {
  it("shows an any-domain Site Builder entry in the immediately visible Dual App Tools grid", () => {
    const source = readProjectFile("client/src/pages/PlatformAdmin.tsx");
    const cardPosition = source.indexOf('id: "site-builder"');
    const perBrandSection = source.indexOf("// Per-Brand tool cards");

    expect(cardPosition).toBeGreaterThan(-1);
    expect(cardPosition).toBeLessThan(perBrandSection);
    expect(source.slice(cardPosition, cardPosition + 500)).toContain('label: "Site Builder"');
    expect(source.slice(cardPosition, cardPosition + 500)).toContain('getAdminUrl("/admin/lms/site-pages")');
    expect(source.slice(cardPosition, cardPosition + 500)).toContain("any configured custom domain");
  });
});
