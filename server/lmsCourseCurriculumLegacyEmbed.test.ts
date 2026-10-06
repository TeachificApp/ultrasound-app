import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const adminSource = readFileSync(resolve(root, "client/src/pages/admin/LMSAdmin.tsx"), "utf8");
const routerSource = readFileSync(resolve(root, "server/routers/lmsCourseBuilderRouter.ts"), "utf8");

describe("LMS curriculum labels and legacy lesson embeds", () => {
  it("keeps quiz-type course structure under the Curriculum tab", () => {
    expect(adminSource).toContain('{course.type === "download" ? "Files" : "Curriculum"}');
    expect(adminSource).not.toContain('course.type === "quiz" ? "Questions"');
  });

  it("makes a persisted legacy multimedia embed visible and removable in lesson settings", () => {
    expect(adminSource).toContain("Embedded multimedia");
    expect(adminSource).toContain("This legacy embed renders above the page-builder blocks");
    expect(adminSource).toContain("Remove embedded media");
    expect(adminSource).toContain('embedUrl: lessonType === "embed" ? (embedUrl.trim() || null) : null');
  });

  it("persists an explicit null embed URL when an admin clears it", () => {
    expect(routerSource).toContain("embedUrl: z.string().max(500).nullable().optional()");
    expect(routerSource).not.toContain('if (updates.embedUrl === null || updates.embedUrl === "")');
  });
});
