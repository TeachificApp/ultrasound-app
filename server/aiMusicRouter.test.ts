import { describe, expect, it } from "vitest";
import { defaultPlan, normalizePlan } from "./routers/aiMusicRouter";

describe("AI music loop composition safety", () => {
  it("creates a bounded original instrumental plan when a model response is absent", () => {
    const plan = defaultPlan("focused", "ambient");
    expect(plan.bpm).toBeGreaterThanOrEqual(64);
    expect(plan.bpm).toBeLessThanOrEqual(150);
    expect(plan.kickPattern).toHaveLength(16);
    expect(plan.leadPattern).toHaveLength(16);
    expect(plan.title).toContain("focused ambient");
  });

  it("normalizes a model composition into safe local-synthesis values", () => {
    const plan = normalizePlan({
      title: "Original pulse!",
      bpm: 999,
      keyRoot: -9,
      scale: "minor",
      density: 12,
      swing: 2,
      kickPattern: Array(16).fill(3),
      snarePattern: Array(16).fill(0),
      hatPattern: Array(16).fill(1),
      bassPattern: Array(16).fill(99),
      leadPattern: Array(16).fill(-4),
    }, "confident", "pulse");

    expect(plan).toMatchObject({
      title: "Original pulse",
      bpm: 150,
      keyRoot: 0,
      scale: "minor",
      mood: "confident",
      texture: "pulse",
      density: 5,
      swing: 0.22,
    });
    expect(plan.kickPattern.every((step) => step === 1)).toBe(true);
    expect(plan.bassPattern.every((step) => step === -1)).toBe(true);
    expect(plan.leadPattern.every((step) => step === -1)).toBe(true);
  });
});
