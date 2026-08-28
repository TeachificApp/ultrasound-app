import { describe, expect, it, vi } from "vitest";
import {
  assertCoursePlayerQuizAccess,
  assertEmbeddedQuizAccess,
} from "./lib/embeddedQuizCourseAccess";

function mockEnrollmentDatabase(
  directAssignments: Array<{ lessonId: number }>,
  sectionAssignments: Array<{ lessonId: number }> = [],
  previewAssignments: Array<{ lessonId: number }> = [],
) {
  let selectCall = 0;
  return {
    select: () => ({
      from: () => {
        selectCall += 1;
        if (selectCall === 1) {
          return {
            innerJoin: () => ({
              where: () => ({
                limit: async () => directAssignments,
              }),
            }),
          };
        }
        if (selectCall === 2) {
          return {
            innerJoin: () => ({
              innerJoin: () => ({
                where: () => ({
                  limit: async () => sectionAssignments,
                }),
              }),
            }),
          };
        }
        return {
          where: () => ({
            limit: async () => previewAssignments,
          }),
        };
      },
    }),
  };
}

describe("embedded quiz course player access", () => {
  it("allows an enrolled learner when the quiz is assigned through a direct course lesson", async () => {
    await expect(assertEmbeddedQuizAccess(mockEnrollmentDatabase([{ lessonId: 42 }]), { id: 7, role: "user" }, 30001)).resolves.toBeUndefined();
  });

  it("allows an enrolled learner when the quiz is assigned through a section lesson", async () => {
    await expect(assertEmbeddedQuizAccess(mockEnrollmentDatabase([], [{ lessonId: 44 }]), { id: 7, role: "user" }, 30001)).resolves.toBeUndefined();
  });

  it("blocks standalone access when no assigned learning experience grants enrollment", async () => {
    await expect(assertEmbeddedQuizAccess(mockEnrollmentDatabase([]), { id: 7, role: "user" }, 30001)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows a logged-in learner when the assigned lesson is configured as a free preview", async () => {
    await expect(assertEmbeddedQuizAccess(mockEnrollmentDatabase([], [], [{ lessonId: 43 }]), { id: 7, role: "user" }, 30001)).resolves.toBeUndefined();
  });

  it("allows legacy administrators to preview embedded quiz content without an enrollment", async () => {
    await expect(assertEmbeddedQuizAccess(mockEnrollmentDatabase([]), { id: 1, role: "admin" }, 30001)).resolves.toBeUndefined();
  });

  it("allows course-player access when the learner is enrolled in the parent course", async () => {
    const db = {
      select: vi.fn()
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: async () => [{
                  id: 99,
                  userId: 7,
                  courseId: 12,
                  enrollmentType: "manual",
                  accessExpiresAt: null,
                }],
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: async () => [{ id: 12 }],
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            leftJoin: () => ({
              where: () => ({
                limit: async () => [{ lessonId: 55 }],
              }),
            }),
          }),
        }),
    };

    await expect(assertCoursePlayerQuizAccess(db, 7, "rphs-test-learn", 30001)).resolves.toBeUndefined();
  });
});
