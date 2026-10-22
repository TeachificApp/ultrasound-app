import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  filterCourseLessonsForLearner,
  groupCourseLessonsBySection,
} from "./lib/courseLessonTree";

describe("course overview and player lesson tree", () => {
  it("loads published lessons through a shared section join helper", () => {
    const helper = fs.readFileSync(
      path.resolve(process.cwd(), "server/lib/courseLessonTree.ts"),
      "utf8",
    );
    const router = fs.readFileSync(
      path.resolve(process.cwd(), "server/routers/lmsRouter.ts"),
      "utf8",
    );
    expect(helper).toContain("leftJoin(lmsSections");
    expect(helper).toContain("eq(lmsSections.courseId, courseId)");
    expect(router).toContain("loadPublishedCourseLessonTree");
  });

  it("shows lesson access errors in the course player instead of a blank pane", () => {
    const player = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/CoursePlayer.tsx"),
      "utf8",
    );
    expect(player).toContain("lessonError");
    expect(player).toContain("This lesson is unavailable");
  });

  it("passes courseId into overview BlockPreview for enrolled media access", () => {
    const overview = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/CourseOverview.tsx"),
      "utf8",
    );
    expect(overview).toContain("BlockPreview key={block.id} block={block} courseId={course.id}");
    expect(overview).toContain("isPresale");
  });

  it("uses the post-purchase-visible lesson list for the Start and Continue target", () => {
    const overview = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/CourseOverview.tsx"),
      "utf8",
    );
    expect(overview).toContain("const postPurchaseLessons = allLessons.filter(isVisibleAfterPurchase)");
    expect(overview).toContain("getFirstLessonVisibleAfterPurchase(postPurchaseLessons)");
  });

  it("filters preview-only lessons before sections are numbered, removing an empty preview module", () => {
    const helper = fs.readFileSync(
      path.resolve(process.cwd(), "server/lib/courseLessonTree.ts"),
      "utf8",
    );
    const router = fs.readFileSync(
      path.resolve(process.cwd(), "server/routers/lmsRouter.ts"),
      "utf8",
    );
    const player = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/CoursePlayer.tsx"),
      "utf8",
    );
    expect(helper).toContain("excludePreviewOnlyAfterPurchase");
    expect(helper).toContain("!isVisibleAfterPurchase(lesson)");
    expect(router).toContain('enrollment?.enrollmentType === "full"');
    expect(router).toContain('enrollmentAccess?.enrollmentType === "full"');
    expect(player).toContain(".filter((section: any) => section.lessons.length > 0)");
  });

  it("removes an empty free-preview module from a full learner's curriculum tree", () => {
    const sections = [{ id: 10, title: "Free sample" }, { id: 20, title: "Coursework" }] as any[];
    const lessons = [
      { id: 1, sectionId: 10, previewMode: "preview_hide_after_purchase" },
      { id: 2, sectionId: 20, previewMode: "none" },
    ] as any[];

    const learnerLessons = filterCourseLessonsForLearner(lessons, {
      excludePreviewOnlyAfterPurchase: true,
    });
    const tree = groupCourseLessonsBySection(sections, learnerLessons, { hideEmptySections: true });

    expect(tree.sections.map((section) => section.id)).toEqual([20]);
    expect(tree.allLessons.map((lesson) => lesson.id)).toEqual([2]);
  });

  it("keys CME-restricted lesson filtering to the active course enrollment", () => {
    const router = fs.readFileSync(
      path.resolve(process.cwd(), "server/routers/lmsRouter.ts"),
      "utf8",
    );
    expect(router).toContain("isCmeCreditRestrictedForCourse(enrollment, course.id)");
    expect(router).toContain("isCmeCreditRestrictedForCourse(enrollmentAccess, course.id)");
    expect(router).not.toContain("Boolean(enrollment?.cmeCreditRestricted)");
  });

  it("resets the Member Hub CME restriction choice when a different product is selected", () => {
    const memberHub = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/admin/AdminUserDetailPage.tsx"),
      "utf8",
    );
    expect(memberHub).toContain("setSelectedCourseId(value);");
    expect(memberHub).toContain("setEnrollCmeCreditRestricted(false);");
    expect(memberHub).toContain("Other course enrollments are unaffected.");
  });
});
