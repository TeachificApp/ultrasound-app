import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const readProjectFile = (path: string) =>
  readFileSync(resolve(projectRoot, path), "utf8");

describe("bundle included physical product cards", () => {
  it("enriches public bundle items with physical product card data", () => {
    const router = readProjectFile("server/routers/bundleRouter.ts");

    expect(router).toContain('item.itemType === "product"');
    expect(router).toContain("thumbnailUrl: physicalProducts.thumbnailUrl");
    expect(router).toContain("description: physicalProducts.description");
    expect(router).toContain("itemCoverImage = p?.thumbnailUrl ?? null");
    expect(router).toContain("itemDescription = p?.description ?? null");
  });

  it("links physical product cards to their canonical sales URLs without nested links", () => {
    const cards = readProjectFile(
      "client/src/components/IncludedItemsBlock.tsx"
    );

    expect(cards).toMatch(
      /case "product":\s*return `\/product\/\$\{item\.itemSlug\}`;/
    );
    expect(cards).toMatch(
      /<Link href=\{href\} className="block h-full">\s*\{inner\}\s*<\/Link>/
    );
    expect(cards).toMatch(
      /<Link href=\{href\} className="block">\s*\{inner\}\s*<\/Link>/
    );
    expect(cards).not.toContain("{href ? (\n            <Link href={href}>");
  });
});
