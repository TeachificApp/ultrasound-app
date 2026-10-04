import { describe, expect, it } from "vitest";
import { enforceTargetWordCountOnEmailBlocks } from "./lib/richTextAiGeneration";
import { countRenderedWords, trimHtmlToWordCount } from "./lib/lessonContentGeneration";

describe("rich text AI word count enforcement", () => {
  it("trims HTML to a maximum readable word count", () => {
    const html = "<p>" + Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ") + "</p>";
    expect(countRenderedWords(trimHtmlToWordCount(html, 100))).toBeLessThanOrEqual(100);
  });

  it("trims combined email blocks toward a target word count", () => {
    const blocks = enforceTargetWordCountOnEmailBlocks([
      { type: "heading", data: { html: "<h2>Heading one two three four five</h2>" } },
      { type: "text", data: { html: "<p>" + Array.from({ length: 120 }, (_, i) => `body${i}`).join(" ") + "</p>" } },
    ], 50);
    const total = blocks.reduce((sum, block) => sum + countRenderedWords(String(block.data?.html ?? "")), 0);
    expect(total).toBeLessThanOrEqual(55);
  });
});
