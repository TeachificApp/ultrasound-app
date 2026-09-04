import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "NewsletterSubscribe.tsx"), "utf8");

describe("newsletter subscribe page required fields", () => {
  it("contains only required First Name, Last Name, and Email inputs", () => {
    expect(source).toContain('id="firstName"\n                required');
    expect(source).toContain('id="lastName"\n                required');
    expect(source).toContain('id="email"\n              type="email"\n              required');
    expect(source).not.toContain("Topics of Interest");
    expect(source).not.toContain("Select your profession");
  });
});
