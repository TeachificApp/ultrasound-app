import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CME certificate celebration", () => {
  const source = readFileSync(resolve(import.meta.dirname, "CoursePlayer.tsx"), "utf8");

  it("fires branded confetti cannons only for an available certificate", () => {
    expect(source).toContain("CME_CERTIFICATE_CONFETTI_COLORS");
    expect(source).toContain("function CertificateConfettiCannons");
    expect(source).toContain('<CertificateConfettiCannons active={open && Boolean(certificateUrl)} />');
    expect(source).toContain("isLeftCannon ? 0 : canvas.width");
  });

  it("does not animate for learners who prefer reduced motion", () => {
    expect(source).toContain('window.matchMedia("(prefers-reduced-motion: reduce)").matches');
    expect(source).toContain('aria-hidden="true"');
  });
});
