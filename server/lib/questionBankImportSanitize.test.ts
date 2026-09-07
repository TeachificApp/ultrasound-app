import { describe, it, expect } from "vitest";
import {
  plainTextFromISpring,
  plainTextFromISpringContent,
  richTextFromISpringContent,
} from "./questionBankImportSanitize";

describe("questionBankImportSanitize", () => {
  it("strips HTML from iSpring group names", () => {
    expect(plainTextFromISpring('<p style="color:red">Echo Assessment VIDEO</p>')).toBe(
      "Echo Assessment VIDEO",
    );
  });

  it("prefers plain text over HTML for question stems", () => {
    expect(
      plainTextFromISpringContent(
        "What is DVT?",
        '<p style="font-size:18px">What is DVT?</p>',
        (v) => v,
      ),
    ).toBe("What is DVT?");
  });

  it("falls back to stripped HTML when plain text is empty", () => {
    expect(
      plainTextFromISpringContent(
        "",
        '<p style="font-size:18px">Which valve is affected?</p>',
        (v) => v,
      ),
    ).toBe("Which valve is affected?");
  });

  it("rewrites storage refs before stripping HTML", () => {
    expect(
      plainTextFromISpringContent(
        "",
        '<p>See image storage://abc.png here</p>',
        (v) => v.replace("storage://abc.png", "https://cdn.example.com/abc.png"),
      ),
    ).toBe("See image https://cdn.example.com/abc.png here");
  });

  it("preserves rewritten HTML when the stem embeds images or videos", () => {
    const html = '<p>Look at this</p><img src="storage://images/scan.png" alt="" />';
    const rewrite = (value: string) => value.replace("storage://images/scan.png", "https://cdn.example/scan.png");

    expect(richTextFromISpringContent("Look at this", html, rewrite)).toBe(
      '<p>Look at this</p><img src="https://cdn.example/scan.png" alt="" />',
    );
  });

  it("falls back to plain text when HTML has no embedded media", () => {
    expect(richTextFromISpringContent("Plain stem", "<p>Plain stem</p>", (value) => value)).toBe("Plain stem");
  });
});
