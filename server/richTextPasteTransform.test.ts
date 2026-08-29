// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  mergeEmojiOnlyPlainTextLines,
  normalizePastedRichTextHtml,
  pastedHtmlHasEmojiOnlyBlocks,
  shouldFallbackToPlainTextEmojiPaste,
} from "@shared/richTextPasteTransform";

describe("richTextPasteTransform", () => {
  it("keeps HTML paste when ChatGPT content has bold and inline emoji", () => {
    const pastedHtml =
      '<p data-start="0" data-end="20"><strong>Important</strong> ✅ note</p>';
    const pastedText = "Important ✅ note";

    expect(pastedHtmlHasEmojiOnlyBlocks(pastedHtml)).toBe(false);
    expect(
      shouldFallbackToPlainTextEmojiPaste({
        pastedHtml,
        pastedText,
        hasImage: false,
      }),
    ).toBe(false);
  });

  it("falls back to plain text when HTML has emoji-only blocks", () => {
    const pastedHtml = "<p>🏆</p><p>Bragging rights</p>";
    const pastedText = "🏆\nBragging rights";

    expect(pastedHtmlHasEmojiOnlyBlocks(pastedHtml)).toBe(true);
    expect(
      shouldFallbackToPlainTextEmojiPaste({
        pastedHtml,
        pastedText,
        hasImage: false,
      }),
    ).toBe(true);
  });

  it("falls back to plain text when HTML is missing but text has emoji", () => {
    expect(
      shouldFallbackToPlainTextEmojiPaste({
        pastedHtml: "",
        pastedText: "✅ Done",
        hasImage: false,
      }),
    ).toBe(true);
  });

  it("does not fall back when paste includes images", () => {
    expect(
      shouldFallbackToPlainTextEmojiPaste({
        pastedHtml: '<p>✅</p><img src="data:image/png;base64,abc" />',
        pastedText: "✅",
        hasImage: true,
      }),
    ).toBe(false);
  });

  it("converts ChatGPT inline font-weight spans to strong tags", () => {
    const input =
      '<p data-start="0" data-end="10"><span style="font-weight: 600;">Bold text</span></p>';
    const output = normalizePastedRichTextHtml(input);

    expect(output).toContain("<strong>Bold text</strong>");
    expect(output).not.toContain("data-start");
    expect(output).not.toContain("font-weight");
  });

  it("preserves semantic bold when emoji is present in the same paragraph", () => {
    const input = "<p><strong>Key point</strong> ✅ remember this</p>";
    const output = normalizePastedRichTextHtml(input);

    expect(output).toContain("<strong>Key point</strong>");
    expect(output).toContain("✅");
  });

  it("merges emoji-only plain-text lines", () => {
    expect(mergeEmojiOnlyPlainTextLines("🏆\nBragging rights\n\nNext para")).toBe(
      "🏆 Bragging rights\n\nNext para",
    );
  });

  it("merges emoji-only HTML blocks with the following block", () => {
    const input = "<p>📌</p><p>Follow-up text</p>";
    const output = normalizePastedRichTextHtml(input);

    expect(output).toContain("📌");
    expect(output).toContain("Follow-up text");
    expect(output.match(/<p/g)?.length).toBe(1);
  });
});
