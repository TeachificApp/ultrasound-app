import { describe, it, expect } from "vitest";
import { z } from "zod";

// Mirror the updated input schema from lmsRouter.ts generateFlashcardsFromLesson
const flashcardInputSchema = z.object({
  lessonId: z.number().int().positive().optional(),
  courseId: z.number().int().positive().optional(),
  lessonIds: z.array(z.number().int().positive()).optional(),
  topic: z.string().max(500).optional(),
  count: z.number().int().min(1).max(30).default(10),
  cardStyle: z.enum(["understanding", "thinking", "compliance", "thought_provoking", "reflection", "custom"]).default("understanding"),
  customPrompt: z.string().max(500).optional(),
});

describe("generateFlashcardsFromLesson input schema", () => {
  it("accepts lessonId only (current lesson mode)", () => {
    const result = flashcardInputSchema.safeParse({ lessonId: 42 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.lessonId).toBe(42);
  });

  it("accepts courseId only (entire course mode)", () => {
    const result = flashcardInputSchema.safeParse({ courseId: 7 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.courseId).toBe(7);
  });

  it("accepts lessonIds array (pick lessons mode)", () => {
    const result = flashcardInputSchema.safeParse({ lessonIds: [1, 2, 3] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.lessonIds).toEqual([1, 2, 3]);
  });

  it("accepts topic only (topic mode)", () => {
    const result = flashcardInputSchema.safeParse({ topic: "Doppler physics" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.topic).toBe("Doppler physics");
  });

  it("accepts all source fields simultaneously", () => {
    const result = flashcardInputSchema.safeParse({ lessonId: 1, courseId: 2, lessonIds: [3], topic: "test" });
    expect(result.success).toBe(true);
  });

  it("accepts no source fields (backend will throw BAD_REQUEST)", () => {
    // Schema allows empty — the business logic in the mutation throws the error
    const result = flashcardInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("applies count default of 10", () => {
    const result = flashcardInputSchema.safeParse({ lessonId: 1 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.count).toBe(10);
  });

  it("rejects count above 30", () => {
    const result = flashcardInputSchema.safeParse({ lessonId: 1, count: 31 });
    expect(result.success).toBe(false);
  });

  it("applies cardStyle default of understanding", () => {
    const result = flashcardInputSchema.safeParse({ lessonId: 1 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cardStyle).toBe("understanding");
  });

  it("accepts all valid cardStyle values", () => {
    const styles = ["understanding", "thinking", "compliance", "thought_provoking", "reflection", "custom"];
    for (const style of styles) {
      const result = flashcardInputSchema.safeParse({ lessonId: 1, cardStyle: style });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid cardStyle", () => {
    const result = flashcardInputSchema.safeParse({ lessonId: 1, cardStyle: "invalid_style" });
    expect(result.success).toBe(false);
  });

  it("rejects topic longer than 500 characters", () => {
    const result = flashcardInputSchema.safeParse({ topic: "a".repeat(501) });
    expect(result.success).toBe(false);
  });
});
