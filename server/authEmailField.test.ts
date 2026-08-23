import { describe, expect, it } from "vitest";
import { authEmailField } from "../shared/authEmailField";
import { normalizeAuthEmail } from "../shared/normalizeAuthEmail";

describe("normalizeAuthEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeAuthEmail("  Lara@Gmail.COM  ")).toBe("lara@gmail.com");
  });

  it("strips zero-width characters", () => {
    expect(normalizeAuthEmail("lara\u200B@gmail.com")).toBe("lara@gmail.com");
  });
});

describe("authEmailField", () => {
  it("accepts emails with surrounding whitespace", () => {
    const result = authEmailField.safeParse("  larawilliams0501@gmail.com  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("larawilliams0501@gmail.com");
    }
  });

  it("rejects invalid addresses", () => {
    const result = authEmailField.safeParse("not-an-email");
    expect(result.success).toBe(false);
  });
});
