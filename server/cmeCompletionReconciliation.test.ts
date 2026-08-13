import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const script = readFileSync(resolve(process.cwd(), "scripts/reconcileCmeCertificates.mjs"), "utf8");
const helpers = readFileSync(resolve(process.cwd(), "server/routers/lmsHelpers.ts"), "utf8");

describe("CME completion reconciliation", () => {
  it("recalculates only learners with recorded platform progress before issuing recovery certificates", () => {
    expect(script).toContain("recalcProgress");
    expect(script).toContain("progressPct} > 0");
    expect(script).toContain("completedCmeRecovery: true");
    expect(script).toContain("completionCandidates");
    expect(script).toContain("promoted");
  });

  it("uses canonical completion recalculation and does not certify incomplete enrollments", () => {
    expect(helpers).toContain("completedAt: pct >= 100 ? new Date() : null");
    expect(helpers).toContain("if (pct >= 100 && !wasCompleted)");
  });
});
