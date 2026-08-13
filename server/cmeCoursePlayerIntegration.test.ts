import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasReachedCmeVideoCompletionThreshold } from "../shared/cmeLessonCompletion";

const coursePlayer = readFileSync(resolve(process.cwd(), "client/src/pages/CoursePlayer.tsx"), "utf8");

describe("CME course player video gate", () => {
  it("uses the shared 90% threshold during video time updates before allowing lesson completion", () => {
    expect(coursePlayer).toContain('import { hasReachedCmeVideoCompletionThreshold }');
    expect(coursePlayer).toContain("onTimeUpdate={(event) => {");
    expect(coursePlayer).toContain("hasReachedCmeVideoCompletionThreshold(video.currentTime, video.duration)");
    expect(coursePlayer).toContain("setVideoWatched(true)");
    expect(hasReachedCmeVideoCompletionThreshold(90, 100)).toBe(true);
  });

  it("communicates the 90% gate rather than requiring the video end event", () => {
    expect(coursePlayer).toContain("Watch at least 90% of this video to mark this lesson complete.");
    expect(coursePlayer).toContain("Watch at least 90% of each required video lesson.");
  });
});
