import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Visual Builder publication safety", () => {
  it("does not include a status field when saving an existing standalone quiz", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "server/routers/quizMakerRouter.ts"), "utf8");
    const existingSave = source.slice(source.indexOf("if (input.quizId)"), source.indexOf("const [result] = await db.insert"));
    expect(existingSave).toContain("builderConfig: serializeBuilderConfig");
    expect(existingSave).not.toMatch(/\bstatus\s*:/);
  });

  it("uses Draft only for creation of a new standalone quiz", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "server/routers/quizMakerRouter.ts"), "utf8");
    const creation = source.slice(source.indexOf("const [result] = await db.insert"), source.indexOf("findAndReplaceText:"));
    expect(creation).toContain('status: "draft"');
  });
});
