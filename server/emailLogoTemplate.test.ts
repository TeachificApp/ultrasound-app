import { describe, expect, it } from "vitest";
import { emailWrapper } from "./_core/email";
import { getBrandDisplayConfig, type BrandMode } from "../shared/brands";

function getHeaderLogoMarkup(html: string): string {
  const image = html.match(/<img\s+[^>]*src="[^"]+"[^>]*>/i)?.[0];
  if (!image) throw new Error("Expected transactional email header to contain a logo image");
  return image;
}

function getImageAttribute(markup: string, attribute: string): string {
  const value = markup.match(new RegExp(`${attribute}="([^"]+)"`, "i"))?.[1];
  if (!value) throw new Error(`Expected logo image ${attribute} attribute`);
  return value;
}

describe("transactional email header logo", () => {
  const cases: Array<{ mode: BrandMode; expectedHostname: string }> = [
    { mode: "aaus", expectedHostname: "www.allaboutultrasound.com" },
    { mode: "combined", expectedHostname: "www.allaboutultrasound.com" },
    { mode: "iheartecho", expectedHostname: "www.iheartecho.com" },
  ];

  it.each(cases)("uses a public, non-expiring $mode logo URL", ({ mode, expectedHostname }) => {
    const logoUrl = getBrandDisplayConfig(mode).emailLogoUrl;
    const url = new URL(logoUrl);

    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe(expectedHostname);
    expect(url.search).toBe("");
    expect(logoUrl).not.toMatch(/private-|manuscdn|cloudfront|signature|expires|key-pair-id/i);
  });

  it.each(cases)("renders accessible fixed-size image markup for $mode", ({ mode }) => {
    const markup = getHeaderLogoMarkup(emailWrapper("<p>Message body</p>", mode));
    const config = getBrandDisplayConfig(mode);

    expect(getImageAttribute(markup, "src")).toBe(config.emailLogoUrl);
    expect(getImageAttribute(markup, "alt")).toBe(`${config.shortName} logo`);
    expect(getImageAttribute(markup, "width")).toBe("76");
    expect(getImageAttribute(markup, "height")).toBe("76");
    expect(markup).toContain('border="0"');
    expect(markup).toContain("display:block");
  });
});
