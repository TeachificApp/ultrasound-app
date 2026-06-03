/**
 * Tests for the getUserCourseProgress procedure input schema
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

const getUserCourseProgressInput = z.object({
  userId: z.number().int(),
  enrollmentId: z.number().int(),
});

describe("getUserCourseProgress input schema", () => {
  it("accepts valid userId and enrollmentId", () => {
    const r = getUserCourseProgressInput.safeParse({ userId: 42, enrollmentId: 7 });
    expect(r.success).toBe(true);
  });

  it("rejects missing userId", () => {
    const r = getUserCourseProgressInput.safeParse({ enrollmentId: 7 });
    expect(r.success).toBe(false);
  });

  it("rejects missing enrollmentId", () => {
    const r = getUserCourseProgressInput.safeParse({ userId: 42 });
    expect(r.success).toBe(false);
  });

  it("rejects non-integer userId", () => {
    const r = getUserCourseProgressInput.safeParse({ userId: 1.5, enrollmentId: 7 });
    expect(r.success).toBe(false);
  });

  it("rejects non-integer enrollmentId", () => {
    const r = getUserCourseProgressInput.safeParse({ userId: 42, enrollmentId: 3.14 });
    expect(r.success).toBe(false);
  });

  it("rejects string values", () => {
    const r = getUserCourseProgressInput.safeParse({ userId: "42", enrollmentId: "7" });
    expect(r.success).toBe(false);
  });
});

describe("lesson progress data shape", () => {
  const lessonProgressShape = z.object({
    id: z.number(),
    title: z.string(),
    type: z.enum(["video", "text", "quiz", "download", "embed", "video_text"]),
    position: z.number(),
    durationMinutes: z.number().nullable(),
    completed: z.boolean(),
    completedAt: z.date().nullable(),
    quizScore: z.number().nullable(),
    quizPassed: z.boolean().nullable(),
    attempts: z.number(),
  });

  it("validates a completed video lesson", () => {
    const r = lessonProgressShape.safeParse({
      id: 1, title: "Intro Video", type: "video", position: 1,
      durationMinutes: 15, completed: true,
      completedAt: new Date(), quizScore: null, quizPassed: null, attempts: 0,
    });
    expect(r.success).toBe(true);
  });

  it("validates a passed quiz lesson", () => {
    const r = lessonProgressShape.safeParse({
      id: 2, title: "Module Quiz", type: "quiz", position: 2,
      durationMinutes: null, completed: true,
      completedAt: new Date(), quizScore: 85, quizPassed: true, attempts: 2,
    });
    expect(r.success).toBe(true);
  });

  it("validates an incomplete lesson", () => {
    const r = lessonProgressShape.safeParse({
      id: 3, title: "Text Lesson", type: "text", position: 3,
      durationMinutes: null, completed: false,
      completedAt: null, quizScore: null, quizPassed: null, attempts: 0,
    });
    expect(r.success).toBe(true);
  });
});
