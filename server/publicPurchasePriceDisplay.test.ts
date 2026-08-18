import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatAuthoredDollars } from "../shared/authoredPriceDisplay";

const pages = [
  "client/src/pages/BundleLanding.tsx",
  "client/src/pages/DownloadLanding.tsx",
  "client/src/pages/ProductLanding.tsx",
].map((path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

describe("public bundle, download, and product price presentation", () => {
  it("preserves explicitly entered cents while retaining a whole-dollar display when no cents were entered", () => {
    expect(formatAuthoredDollars("299.97")).toBe("$299.97");
    expect(formatAuthoredDollars("7.00")).toBe("$7.00");
    expect(formatAuthoredDollars("7")).toBe("$7");
  });

  it("routes the public bundle, download, and product purchase surfaces through the shared formatter", () => {
    for (const source of pages) {
      expect(source).toContain('from "@shared/authoredPriceDisplay"');
      expect(source).toContain("formatAuthoredDollars(");
    }
  });
});
