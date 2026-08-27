import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("CME certificate recovery", () => {
  it("uses shared restore helper from getCourseCertificate", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers/lmsRouter.ts"), "utf8");
    expect(router).toContain("restoreMissingCourseCertificate");
  });

  it("always loads certificate data for recovery in CertificatePreviewBlock", () => {
    const block = readFileSync(
      resolve(process.cwd(), "client/src/components/CertificatePreviewBlock.tsx"),
      "utf8",
    );
    expect(block).toContain("{ enabled: !!courseSlug }");
    expect(block).toContain("!cert?.certificateUrl");
  });
});
