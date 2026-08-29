import { describe, expect, it } from "vitest";

describe("lmsAdminRouter AI procedures", () => {
  const AI_PROCS = [
    "generateLessonContent",
    "generatePromoContent",
    "generateQuizFromLesson",
    "generateFlashcardsFromLesson",
    "generateAiImage",
    "listTestimonialPresets",
    "saveTestimonialPreset",
    "deleteTestimonialPreset",
  ];

  it("registers AI generation procedures on lmsAdmin", async () => {
    const { lmsAdminRouter } = await import("./routers/lmsRouter");
    const procs = (lmsAdminRouter as { _def: { procedures: Record<string, unknown> } })._def
      .procedures;
    for (const name of AI_PROCS) {
      expect(procs[name], `Procedure '${name}' should exist on lmsAdmin`).toBeDefined();
    }
  });
});
