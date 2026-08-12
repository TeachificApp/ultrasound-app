import { describe, expect, it } from "vitest";
import { assertEmbeddedQuizAccess } from "./routers/standaloneQuizRouter";

function mockDatabase(assignments: Array<{ lessonId: number }>, previewAssignments: Array<{ lessonId: number }> = []) {
  return {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: async () => assignments,
          }),
        }),
        where: () => ({
          limit: async () => previewAssignments,
        }),
      }),
    }),
  };
}

describe("embedded Quiz Creator access", () => {
  it("allows an enrolled learner when the quiz is assigned through an LMS lesson", async () => {
    await expect(assertEmbeddedQuizAccess(mockDatabase([{ lessonId: 42 }]), { id: 7, role: "user" }, 30001)).resolves.toBeUndefined();
  });

  it("blocks standalone access when no assigned learning experience grants enrollment", async () => {
    await expect(assertEmbeddedQuizAccess(mockDatabase([]), { id: 7, role: "user" }, 30001)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows a logged-in learner when the assigned lesson is configured as a free preview", async () => {
    await expect(assertEmbeddedQuizAccess(mockDatabase([], [{ lessonId: 43 }]), { id: 7, role: "user" }, 30001)).resolves.toBeUndefined();
  });

  it("allows an administrator to preview embedded quiz content without an enrollment", async () => {
    await expect(assertEmbeddedQuizAccess(mockDatabase([]), { id: 1, role: "admin" }, 30001)).resolves.toBeUndefined();
  });
});
