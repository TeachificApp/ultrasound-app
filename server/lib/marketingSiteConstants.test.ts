import { describe, it, expect } from "vitest";
import { sourceUrlToPath, rewriteLinkForStaging, isMarketingStagingHost } from "@shared/marketingSiteConstants";

describe("marketingSiteConstants", () => {
  it("maps homepage URLs to /", () => {
    expect(sourceUrlToPath("https://www.allaboutultrasound.com/")).toBe("/");
    expect(sourceUrlToPath("https://www.allaboutultrasound.com/index.html")).toBe("/");
  });

  it("preserves .html paths", () => {
    expect(sourceUrlToPath("https://www.allaboutultrasound.com/about.html")).toBe("/about.html");
  });

  it("rewrites internal links to staging", () => {
    expect(rewriteLinkForStaging("https://www.allaboutultrasound.com/contact.html"))
      .toBe("https://site.allaboutultrasound.com/contact.html");
  });

  it("keeps member/learn subdomains external", () => {
    expect(rewriteLinkForStaging("https://member.allaboutultrasound.com/users/sign_in"))
      .toBe("https://member.allaboutultrasound.com/users/sign_in");
  });

  it("detects staging host", () => {
    expect(isMarketingStagingHost("site.allaboutultrasound.com")).toBe(true);
    expect(isMarketingStagingHost("app.allaboutultrasound.com")).toBe(false);
  });
});
