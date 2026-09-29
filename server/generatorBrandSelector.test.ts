import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function readProjectFile(relativePath: string) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("generator brand selectors", () => {
  it("allows the Social generator to switch brands and query/save the selected library", async () => {
    const source = await readProjectFile(
      "client/src/pages/SocialContentGenerator.tsx"
    );

    expect(source).toContain(
      'const [selectedBrand, setSelectedBrand] = useState<"aaus" | "iheartecho">(routeBrand)'
    );
    expect(source).toContain('aria-label="Generator brand"');
    expect(source).toContain('value="aaus"');
    expect(source).toContain('value="iheartecho"');
    expect(source).toContain("brand: presentation.brand");
    expect(source).toContain(
      "useQuery({ brand: presentation.brand, limit: 100 })"
    );
  });

  it("allows the Challenge generator to switch the rendered card brand", async () => {
    const source = await readProjectFile(
      "client/src/pages/ChallengeCardGenerator.tsx"
    );

    expect(source).toContain(
      'const [selectedBrand, setSelectedBrand] = useState<"aaus" | "iheartecho">(routeBrand)'
    );
    expect(source).toContain('aria-label="Generator brand"');
    expect(source).toContain("brandName: presentation.displayName");
    expect(source).toContain("musicUploadBrand={presentation.brand}");
  });
});
