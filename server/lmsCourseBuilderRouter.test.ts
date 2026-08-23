import { describe, expect, it } from "vitest";

describe("lmsCourseBuilderRouter imports", () => {
  it("imports router and procedures from trpc core", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./routers/lmsCourseBuilderRouter.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain('from "../_core/trpc"');
    expect(source).toContain("router");
    expect(source).toContain("protectedProcedure");
  });

  it("loads without ReferenceError at runtime", async () => {
    await expect(import("./routers/lmsCourseBuilderRouter")).resolves.toBeDefined();
  });
});
