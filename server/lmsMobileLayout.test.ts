import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/admin/LMSAdmin.tsx"), "utf8");
const courseRow = source.slice(source.indexOf("function SortableCourseRow"), source.indexOf("function SortableRecordingRow"));
const lessonEditor = source.slice(source.indexOf("function LessonEditor"), source.indexOf("/* Tab Content */", source.indexOf("function LessonEditor")));

describe("LMS administration mobile layouts", () => {
  it("gives Course titles a full mobile row and only truncates at larger breakpoints", () => {
    expect(courseRow).toContain("order-2 basis-full min-w-0 sm:order-none sm:basis-auto sm:flex-1");
    expect(courseRow).toContain("whitespace-normal break-words sm:truncate");
  });

  it("moves Course badges and actions below the title on mobile", () => {
    expect(courseRow).toContain("order-3 text-xs sm:order-none");
    expect(courseRow).toContain("order-4 h-7 text-xs text-teal-600");
  });

  it("allows the lesson-editor header to wrap without overlapping controls", () => {
    expect(lessonEditor).toContain("flex flex-wrap items-center");
    expect(lessonEditor).toContain("order-3 basis-full min-w-0");
    expect(lessonEditor).toContain("order-4 basis-full justify-center");
  });
});
