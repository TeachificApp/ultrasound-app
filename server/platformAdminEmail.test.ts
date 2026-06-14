import { describe, it, expect } from "vitest";
describe("PLATFORM_ADMIN_EMAIL env", () => {
  it("should be a valid admin email address", () => {
    const email = process.env.PLATFORM_ADMIN_EMAIL ?? "admin@allaboutultrasound.com";
    expect(email).toBeTruthy();
    expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(email).not.toContain("larawilliams");
    expect(email).not.toContain("gmail.com");
  });
});
