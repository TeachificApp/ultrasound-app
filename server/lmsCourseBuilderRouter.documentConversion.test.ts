import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/routers/lmsCourseBuilderRouter.ts"), "utf8");

describe("lesson document conversion option contract", () => {
  it("validates and passes the PowerPoint header/footer choice to the protected converter", () => {
    expect(source).toContain("includePptxHeadersAndFooters: z.boolean().optional()");
    expect(source).toContain("{ includeHeadersAndFooters: input.includePptxHeadersAndFooters !== false }");
  });
});
