import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

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
});
