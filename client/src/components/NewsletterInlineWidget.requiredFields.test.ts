import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "NewsletterInlineWidget.tsx"), "utf8");

describe("inline newsletter required fields", () => {
  it("requires and submits First Name, Last Name, and Email", () => {
    expect(source).toContain('placeholder="First Name"');
    expect(source).toContain('placeholder="Last Name"');
    expect(source).toContain('placeholder="Email address"');
    expect(source).toContain("firstName: firstName.trim()");
    expect(source).toContain("lastName: lastName.trim()");
    expect(source).toContain("First name, last name, and email are required.");
  });
});
