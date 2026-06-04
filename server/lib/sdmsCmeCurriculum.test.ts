import { describe, expect, it } from "vitest";
import {
  buildCmeLessonBlocks,
  buildSdmsCmeModuleBlock,
  CME_LESSON_TITLE,
  CME_SECTION_TITLE,
  isLmsCurriculumActivity,
  lessonTitleForFormKind,
} from "./sdmsCmeCurriculum";

describe("sdmsCmeCurriculum", () => {
  it("identifies LMS curriculum activity types", () => {
    expect(isLmsCurriculumActivity("course")).toBe(true);
    expect(isLmsCurriculumActivity("cohort")).toBe(true);
    expect(isLmsCurriculumActivity("webinar")).toBe(false);
  });

  it("builds sdms_cme_module block with activity binding", () => {
    const block = buildSdmsCmeModuleBlock({
      id: 5,
      activityType: "course",
      activityId: 42,
      activityTitle: "Echo CME",
    });
    expect(block.type).toBe("sdms_cme_module");
    expect(block.data.activityType).toBe("course");
    expect(block.data.activityId).toBe(42);
    expect(block.data.headline).toBe("Echo CME");
  });

  it("builds default lesson blocks with hero, instructions, and CME module", () => {
    const blocks = buildCmeLessonBlocks({
      id: 1,
      activityType: "cohort",
      activityId: 10,
      activityTitle: "Live Cohort CME",
      cmeInstructions: "Complete all questions.",
      moduleBlocks: null,
    });
    expect(blocks.some((b) => b.type === "hero")).toBe(true);
    expect(blocks.some((b) => b.type === "text")).toBe(true);
    expect(blocks.some((b) => b.type === "sdms_cme_module")).toBe(true);
  });

  it("uses form kind for lesson title labels", () => {
    expect(lessonTitleForFormKind("post_test")).toBe("CME Post-Test");
    expect(lessonTitleForFormKind("combined")).toBe(CME_LESSON_TITLE);
  });

  it("uses standard section title constant", () => {
    expect(CME_SECTION_TITLE).toBe("SDMS CME Credit");
  });
});
