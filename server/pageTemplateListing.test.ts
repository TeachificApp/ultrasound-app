import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Page Template listing contract", () => {
  const source = readFileSync(resolve(import.meta.dirname, "routers/lmsQuizLandingRouter.ts"), "utf8");

  it("loads only the template fields required by the picker", () => {
    const start = source.indexOf("listPageTemplates:");
    const end = source.indexOf("savePageTemplate:", start);
    const procedure = source.slice(start, end);

    expect(procedure).toContain("templateType: lmsPageTemplates.templateType");
    expect(procedure).toContain("blocks: lmsPageTemplates.blocks");
    expect(procedure).not.toContain("thumbnailUrl: lmsPageTemplates.thumbnailUrl");
    expect(procedure).not.toContain("db.select().from(lmsPageTemplates)");
  });
});
