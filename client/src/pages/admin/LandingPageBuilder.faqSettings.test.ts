import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./LandingPageBuilder.tsx", import.meta.url), "utf8");

describe("FAQ block settings order", () => {
  it("places FAQ items directly after the section headline and before color formatting", () => {
    const faqCaseStart = source.indexOf('case "faq":');
    const faqCaseEnd = source.indexOf('case "ticker":', faqCaseStart);
    const faqSettings = source.slice(faqCaseStart, faqCaseEnd);

    expect(faqSettings.indexOf('label="Section Headline"')).toBeGreaterThanOrEqual(0);
    expect(faqSettings.indexOf("FAQ Items")).toBeGreaterThan(faqSettings.indexOf('label="Section Headline"'));
    expect(faqSettings.indexOf("FAQ Items")).toBeLessThan(faqSettings.indexOf("Color Scheme"));
  });
});
