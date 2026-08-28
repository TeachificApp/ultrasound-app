import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("learner content access", () => {
  it("imports the enrollment completion helper used while preparing My Content certificates", () => {
    const router = read("server/routers/dashboardRouter.ts");
    expect(router).toContain('import { isEnrollmentCompleted } from "../lib/enrollmentAccess";');
    expect(router).toContain("isEnrollmentCompleted({ completedAt: course.completedAt, progressPct: course.progressPct })");
  });

  it("routes authenticated SCORM ZIP course blocks to the protected interactive player", () => {
    const iframe = read("client/src/components/MediaEmbedIframe.tsx");
    const blocks = read("client/src/components/BlockPreview.tsx");
    const player = read("client/src/pages/CoursePlayer.tsx");
    expect(iframe).toContain("trpc.mediaRepo.getScormZipUrl.useQuery");
    expect(iframe).toContain("<ScormPlayer");
    expect(blocks).toContain("isInteractiveMediaPackage(mediaType, d.fileName ?? fileName)");
    expect(blocks).toContain("src={mediaRepoScormUrl(slug)}");
    expect(player).toContain("linkedMediaAsset");
    expect(player).toContain("resolveLessonMediaScormUrl");
    expect(player).toContain("showLessonLevelScorm");
  });
});
