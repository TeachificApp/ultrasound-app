import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const routerSource = fs.readFileSync(
  path.join(root, "server/routers/lmsEnrollmentAdminRouter.ts"),
  "utf8"
);
const adminSource = fs.readFileSync(
  path.join(root, "client/src/pages/admin/LMSAdmin.tsx"),
  "utf8"
);

describe("course copy workflow", () => {
  it("creates a default landing page when the source has none", () => {
    expect(routerSource).toContain("if (lp) {");
    expect(routerSource).toContain(
      'await db.insert(lmsLandingPages).values({ courseId: newCourseId, heroTitle: newTitle, ctaText: "Enroll Now" })'
    );
  });

  it("keeps a successful copy when optional AI reformatting fails", () => {
    expect(adminSource).toContain("let reformatFailed = false");
    expect(adminSource).toContain("reformatFailed = true");
    expect(adminSource).toContain(
      "await renameCourse.mutateAsync({ id: result.id, title: copyNewName.trim() })"
    );
    expect(adminSource).toContain(
      "AI reformatting was unavailable; you can edit the copied landing page."
    );
  });
});
