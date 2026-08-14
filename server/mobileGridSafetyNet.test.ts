import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("global mobile grid safety net", () => {
  it("collapses legacy fixed grids on the narrowest phones while allowing intentional compact grids to opt out", () => {
    expect(styles).toContain("@media (max-width: 479px)");
    expect(styles).toContain(".grid.grid-cols-2:not(.mobile-keep-grid)");
    expect(styles).toContain(".grid.grid-cols-6:not(.mobile-keep-grid)");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) !important");
  });
});
