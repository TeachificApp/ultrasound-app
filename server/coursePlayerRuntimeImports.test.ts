import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Course Player runtime imports", () => {
  it("imports cn before using it in learner content and quiz result class names", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/CoursePlayer.tsx"), "utf8");
    expect(source).toContain('import { cn } from "@/lib/utils";');
    expect(source).toContain("cn(\"rounded-xl p-4 border\"");
  });
});
