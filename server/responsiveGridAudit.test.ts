import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

function findTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findTsxFiles(path);
    return entry.isFile() && path.endsWith(".tsx") ? [path] : [];
  });
}

const root = resolve(process.cwd(), "client/src");
const styles = readFileSync(join(root, "index.css"), "utf8");
const gridFiles = findTsxFiles(root).filter((path) => /grid-cols-[2-9]/.test(readFileSync(path, "utf8")));

describe("platform-wide fixed-grid responsive audit", () => {
  it("covers every page or component using legacy fixed grid columns on phones", () => {
    expect(gridFiles.length).toBeGreaterThan(200);
    expect(styles).toContain("@media (max-width: 479px)");
    for (const columns of [2, 3, 4, 5, 6]) {
      expect(styles).toContain(`.grid.grid-cols-${columns}:not(.mobile-keep-grid)`);
    }
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) !important");
  });

  it("documents an explicit opt-out for intentionally compact grids", () => {
    expect(styles).toContain("mobile-keep-grid");
  });
});
