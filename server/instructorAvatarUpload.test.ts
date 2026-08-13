import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const adminSource = readFileSync(resolve(process.cwd(), "client/src/pages/admin/LMSAdmin.tsx"), "utf8");
const landingBuilderSource = readFileSync(resolve(process.cwd(), "client/src/pages/admin/LandingPageBuilder.tsx"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers/lmsEnrollmentAdminRouter.ts"), "utf8");

describe("instructor avatar upload", () => {
  it("offers an image-only upload, circular preview, replacement, and removal workflow", () => {
    expect(adminSource).toContain('accept="image/png,image/jpeg,image/webp,image/gif"');
    expect(adminSource).toContain('file.size > 10_000_000');
    expect(adminSource).toContain('fetch("/api/upload-course-image"');
    expect(adminSource).toContain('rounded-full border border-teal-100 object-cover');
    expect(adminSource).toContain('"Replace photo"');
    expect(adminSource).toContain('setAvatarUrl("")');
  });

  it("persists the supplied avatar URL on instructor create and update", () => {
    expect(routerSource).toContain('avatarUrl: input.avatarUrl ?? null');
    expect(routerSource).toContain('avatarUrl: z.string().optional()');
  });

  it("offers the same image upload workflow when a landing page creates an instructor profile", () => {
    expect(landingBuilderSource).toContain('function InlineInstructorFormDialog');
    expect(landingBuilderSource).toContain('accept="image/png,image/jpeg,image/webp,image/gif"');
    expect(landingBuilderSource).toContain('fetch("/api/upload-course-image"');
    expect(landingBuilderSource).toContain('"Upload photo"');
    expect(landingBuilderSource).toContain('rounded-full border border-teal-100 object-cover');
  });
});
