import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCmeCertificateFileKey } from "./lib/cmeCertificateFilename";

describe("CME certificate download filename", () => {
  it("uses the requested AllAboutUltrasound_CME prefix with a readable safe course title", () => {
    expect(buildCmeCertificateFileKey("Adult Echo: A & B", new Date("2026-09-01T15:00:00.000Z"), "a1b2c3d4e5f6"))
      .toBe("certificates/AllAboutUltrasound_CME_Adult_Echo_A_B_20260901_a1b2c3d4e5f6.pdf");
  });

  it("uses the unique suffix without placing learner identity in a public storage key", () => {
    const first = buildCmeCertificateFileKey("CME", new Date("2026-09-01T15:00:00.000Z"), "111111111111");
    const second = buildCmeCertificateFileKey("CME", new Date("2026-09-01T15:00:00.000Z"), "222222222222");
    expect(first).not.toBe(second);
    expect(first).not.toMatch(/learner|user\d+/i);
  });

  it("is used for both initial issuance and download-time refresh", () => {
    const helperSource = readFileSync(resolve(import.meta.dirname, "routers/lmsHelpers.ts"), "utf8");
    const routerSource = readFileSync(resolve(import.meta.dirname, "routers/lmsRouter.ts"), "utf8");
    expect(helperSource).toContain("buildCmeCertificateFileKey(course.title, issuedAt, suffix)");
    expect(routerSource).toContain("buildCmeCertificateFileKey(course.title, cert.issuedAt, suffix)");
  });
});
