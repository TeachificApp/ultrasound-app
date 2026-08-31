import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasReachedCmeVideoCompletionThreshold, shouldAutoCompleteCmeLessonOnAdvance, isCertificateCourse, lessonRequiresExplicitCompletion } from "../shared/cmeLessonCompletion";

const coursePlayer = readFileSync(resolve(process.cwd(), "client/src/pages/CoursePlayer.tsx"), "utf8");

describe("CME course player video gate", () => {
  it("uses the shared 90% threshold during video time updates before allowing lesson completion", () => {
    expect(coursePlayer).toContain("hasReachedCmeVideoCompletionThreshold");
    expect(coursePlayer).toContain("shouldAutoCompleteCmeLessonOnAdvance");
    expect(coursePlayer).toContain("isCertificateCourse");
    expect(coursePlayer).toContain("buildPrereqLockedIds");
    expect(coursePlayer).toContain("onTimeUpdate={(event) => {");
    expect(coursePlayer).toContain("hasReachedCmeVideoCompletionThreshold(video.currentTime, video.duration)");
    expect(coursePlayer).toContain("setVideoWatched(true)");
    expect(hasReachedCmeVideoCompletionThreshold(90, 100)).toBe(true);
  });

  it("communicates the 90% gate rather than requiring the video end event", () => {
    expect(coursePlayer).toContain("Watch at least 90% of this video to mark this lesson complete.");
    expect(coursePlayer).toContain("Watch at least 90% of each required video lesson.");
  });

  it("auto-completes eligible CME lessons on Next while preserving explicit video and quiz completion gates", () => {
    expect(coursePlayer).toContain("shouldAutoCompleteCmeLessonOnAdvance");
    expect(coursePlayer).toContain("const handleNextLesson = async () => {");
    expect(coursePlayer).toContain("onClick={handleNextLesson}");
    expect(shouldAutoCompleteCmeLessonOnAdvance({ isCmeCourse: true, lessonType: "text", requiresVideoCompletion: false, hasInlineQuiz: false, isCompleted: false })).toBe(true);
    expect(shouldAutoCompleteCmeLessonOnAdvance({ isCmeCourse: true, lessonType: "video", requiresVideoCompletion: true, hasInlineQuiz: false, isCompleted: false })).toBe(false);
    expect(shouldAutoCompleteCmeLessonOnAdvance({ isCmeCourse: true, lessonType: "video", requiresVideoCompletion: false, hasInlineQuiz: false, isCompleted: false })).toBe(true);
    expect(shouldAutoCompleteCmeLessonOnAdvance({ isCmeCourse: true, lessonType: "video_text", requiresVideoCompletion: false, hasInlineQuiz: false, isCompleted: false })).toBe(true);
    expect(shouldAutoCompleteCmeLessonOnAdvance({ isCmeCourse: true, lessonType: "text", requiresVideoCompletion: false, hasInlineQuiz: true, isCompleted: false })).toBe(false);
    expect(shouldAutoCompleteCmeLessonOnAdvance({ isCmeCourse: true, lessonType: "text", requiresVideoCompletion: false, hasInlineQuiz: false, hasSdmsCmeModule: true, isCompleted: false })).toBe(false);
  });

  it("persists opened state for initial and auto-advanced lessons so normal CME progression survives refresh", () => {
    expect(coursePlayer).toContain("A lesson can be selected from the initial course route");
    expect(coursePlayer).toContain("recordLessonOpened.mutate({");
    expect(coursePlayer).toContain("setTimeout(() => handleLessonSelect(nextLesson.id), navDelay)");
  });

  it("treats certificate courses by hasCertificate alone (credit hours optional)", () => {
    expect(isCertificateCourse({ hasCertificate: true, creditHours: null })).toBe(true);
    expect(isCertificateCourse({ hasCertificate: true, creditHours: "2" })).toBe(true);
    expect(isCertificateCourse({ hasCertificate: false, creditHours: "2" })).toBe(false);
  });

  it("resolves explicit completion from lesson and course defaults", () => {
    expect(lessonRequiresExplicitCompletion({ requireManualComplete: 1 }, true)).toBe(true);
    expect(lessonRequiresExplicitCompletion({ requireManualComplete: 0 }, true)).toBe(false);
    expect(lessonRequiresExplicitCompletion({}, false)).toBe(false);
    expect(lessonRequiresExplicitCompletion({ requireVideoCompletion: 1 }, false)).toBe(true);
  });
});
