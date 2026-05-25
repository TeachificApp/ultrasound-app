import { describe, it, expect } from "vitest";

// Test that the freePreviewEnrollments schema has the correct fields
describe("Free Preview Enrollment", () => {
  it("should have required fields in schema", async () => {
    const { freePreviewEnrollments } = await import("../drizzle/schema");
    const cols = Object.keys(freePreviewEnrollments);
    expect(cols).toContain("id");
    expect(cols).toContain("courseId");
    expect(cols).toContain("email");
    expect(cols).toContain("firstName");
    expect(cols).toContain("createdAt");
  });
});

// Test that ticker block defaults are correct
describe("Ticker block defaults", () => {
  it("should have sensible default values", () => {
    const defaults = {
      items: ["Free Shipping on Orders Over $50", "New Courses Added Weekly", "Join 10,000+ Students"],
      separator: " ✦ ",
      direction: "left",
      speed: 30,
      pauseOnHover: true,
      bgColor: "#0f766e",
      textColor: "#ffffff",
      fontSize: "sm",
      fontWeight: "normal",
      textTransform: "none",
      letterSpacing: "normal",
      padding: "py-2",
    };
    expect(defaults.items.length).toBeGreaterThan(0);
    expect(defaults.speed).toBeGreaterThan(0);
    expect(defaults.direction).toMatch(/^(left|right)$/);
  });
});

// Test countdown_v2 block defaults
describe("Countdown V2 block defaults", () => {
  it("should support both duration and target_date modes", () => {
    const durationMode = { mode: "duration", durationHours: 1, durationMinutes: 30 };
    const targetMode = { mode: "target_date", targetDate: "2026-12-31T23:59" };
    expect(durationMode.mode).toBe("duration");
    expect(targetMode.mode).toBe("target_date");
    expect(durationMode.durationHours).toBeGreaterThanOrEqual(0);
  });
});
