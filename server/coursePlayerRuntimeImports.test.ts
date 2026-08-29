import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Course Player runtime imports", () => {
  it("imports cn before using it in learner content and quiz result class names", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/CoursePlayer.tsx"), "utf8");
    expect(source).toContain('import { cn } from "@/lib/utils";');
    expect(source).toContain("cn(\"rounded-xl p-4 border\"");
  });

  it("declares lesson SCORM useMemo hooks before loading early returns (React #310)", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/CoursePlayer.tsx"), "utf8");
    const fnStart = source.indexOf("export default function CoursePlayer()");
    expect(fnStart).toBeGreaterThan(-1);
    const body = source.slice(fnStart);
    const hooksMarker = body.indexOf("const lessonMediaRepoScormSrc = useMemo");
    const earlyReturn = body.indexOf("if (authLoading || isLoading)");
    expect(hooksMarker).toBeGreaterThan(-1);
    expect(earlyReturn).toBeGreaterThan(-1);
    expect(hooksMarker).toBeLessThan(earlyReturn);
  });
});
