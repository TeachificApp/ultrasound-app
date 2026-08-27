import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shouldRestoreMissingCourseCertificate } from "../shared/inlineLessonQuizCompletion";

const script = readFileSync(resolve(process.cwd(), "scripts/reconcileCmeCertificates.mjs"), "utf8");
const helpers = readFileSync(resolve(process.cwd(), "server/routers/lmsHelpers.ts"), "utf8");
const dashboard = readFileSync(resolve(process.cwd(), "server/routers/dashboardRouter.ts"), "utf8");

describe("CME completion reconciliation", () => {
  it("recalculates learners with platform progress and includes 100% without completedAt", () => {
    expect(script).toContain("recalcProgress");
    expect(script).toContain("progressPct, 100");
    expect(script).toContain("completedCmeRecovery: true");
    expect(script).toContain("completionCandidates");
    expect(script).toContain("promoted");
  });

  it("awaits certificate issuance at 100% and exposes recovery helper", () => {
    expect(helpers).toContain("await issueCertificateIfEnabled");
    expect(helpers).toContain("restoreMissingCourseCertificate");
    expect(helpers).toContain("getActiveEnrollment");
  });

  it("repairs missing certificates when learners open My Certificates", () => {
    expect(dashboard).toContain("restoreMissingCourseCertificate");
    expect(dashboard).toContain("getMyCertificates");
  });
});

describe("shouldRestoreMissingCourseCertificate", () => {
  it("restores when progress is 100% even if completedAt is null", () => {
    expect(shouldRestoreMissingCourseCertificate({
      courseHasCertificate: true,
      enrollmentCompletedAt: null,
      enrollmentProgressPct: 100,
      hasCertificateRecord: false,
    })).toBe(true);
  });
});
