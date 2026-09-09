import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/Premium.tsx"), "utf8");

describe("Premium membership plan card layout", () => {
  it("keeps plan CTAs large enough to wrap rather than clipping long labels", () => {
    expect(source).toContain("min-h-12 w-full items-center justify-center");
    expect(source).toContain("whitespace-normal");
    expect(source).toContain("leading-tight");
    expect(source).toContain("shrink-0");
  });

  it("provides consistent breathing room before every plan CTA", () => {
    expect((source.match(/mt-auto pt-4/g) ?? []).length).toBe(4);
    expect((source.match(/min-h-\[292px\]/g) ?? []).length).toBe(4);
  });

  it("does not compress four cards until the extra-wide breakpoint", () => {
    expect(source).toContain("sm:grid-cols-2 xl:grid-cols-4");
    expect(source).toContain("max-w-6xl");
  });
});
