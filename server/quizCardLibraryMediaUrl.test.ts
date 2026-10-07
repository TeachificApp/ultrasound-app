import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(
  new URL("./routers/quizCardLibraryRouter.ts", import.meta.url),
  "utf8",
);

describe("Quiz Card Library media URL validation", () => {
  it("accepts trusted same-origin Question Bank card media routes", () => {
    expect(routerSource).toContain('value.startsWith("/api/question-bank-card-media/")');
    expect(routerSource).toContain('value.startsWith("/api/media/")');
    expect(routerSource).toContain("const libraryMediaUrlSchema");
  });

  it("keeps external media constrained to http or https URLs", () => {
    expect(routerSource).toContain('parsed.protocol === "https:" || parsed.protocol === "http:"');
    expect(routerSource).not.toContain('z.string().url().optional()');
  });

  it("requires a media URL only when the saved card declares image or video media", () => {
    expect(routerSource).toContain('media.kind !== "none" && !media.url');
    expect(routerSource).toContain("Select or upload media before saving this Quiz Card.");
  });
});
