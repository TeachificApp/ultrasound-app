import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasReachedCmeVideoCompletionThreshold, shouldAutoCompleteCmeLessonOnAdvance } from "../shared/cmeLessonCompletion";

const coursePlayer = readFileSync(resolve(process.cwd(), "client/src/pages/CoursePlayer.tsx"), "utf8");

describe("CME course player video gate", () => {
  it("uses the shared 90% threshold during video time updates before allowing lesson completion", () => {
    expect(coursePlayer).toContain("import { hasReachedCmeVideoCompletionThreshold, shouldAutoCompleteCmeLessonOnAdvance }");
    expect(coursePlayer).toContain("onTimeUpdate={(event) => {");
    expect(coursePlayer).toContain("hasReachedCmeVideoCompletionThreshold(video.currentTime, video.duration)");
    expect(coursePlayer).toContain("setVideoWatched(true)");
    expect(hasReachedCmeVideoCompletionThreshold(90, 100)).toBe(true);
  });

  it("communicates the 90% gate rather than requiring the video end event", () => {
    expect(coursePlayer).toContain("Watch at least 90% of this video to mark this lesson complete.");
    expect(coursePlayer).toContain("Watch at least 90% of each required video lesson.");
  });

  it("auto-completes ordinary CME lessons on Next while preserving video and quiz completion gates", () => {
    expect(coursePlayer).toContain("shouldAutoCompleteCmeLessonOnAdvance");
    expect(coursePlayer).toContain("const handleNextLesson = async () => {");
    expect(coursePlayer).toContain("onClick={handleNextLesson}");
    expect(shouldAutoCompleteCmeLessonOnAdvance({ isCmeCourse: true, lessonType: "text", requiresVideoCompletion: false, hasInlineQuiz: false, isCompleted: false })).toBe(true);
    expect(shouldAutoCompleteCmeLessonOnAdvance({ isCmeCourse: true, lessonType: "video", requiresVideoCompletion: true, hasInlineQuiz: false, isCompleted: false })).toBe(false);
    expect(shouldAutoCompleteCmeLessonOnAdvance({ isCmeCourse: true, lessonType: "text", requiresVideoCompletion: false, hasInlineQuiz: true, isCompleted: false })).toBe(false);
  });
});
