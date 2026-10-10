import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const scanCoach = readFileSync(
  resolve(process.cwd(), "client/src/pages/iheartecho/ScanCoach.tsx"),
  "utf8",
);

describe("ScanCoach compact selector layout", () => {
  it("keeps the specialty selector first and collapsed on every viewport", () => {
    expect(scanCoach).toContain('title="ScanCoach specialty selector"');
    expect(scanCoach).toContain('selectorId="scancoach-specialty-selector"');
    expect(scanCoach).toContain("Choose a specialty without covering the clinical guide.");
    expect(scanCoach).not.toContain('grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mb-4');
  });

  it("moves TTE and Fetal view selection above clinical detail using accessible selectors", () => {
    expect(scanCoach).toContain('selectorId="tte-view-selector"');
    expect(scanCoach).toContain('title="TTE view selector"');
    expect(scanCoach).toContain('selectorId="fetal-view-selector"');
    expect(scanCoach).toContain('title="Fetal Echo view selector"');
    expect(scanCoach).toContain('className="group overflow-hidden rounded-xl border border-[#189aa1]/25 bg-white shadow-sm"');
    expect(scanCoach).not.toContain("View list sidebar — sticky on desktop");
    expect(scanCoach).not.toContain("View list sidebar — sticky on desktop, above content on mobile");
  });

  it("preserves all choices through native selects and selection callbacks", () => {
    expect(scanCoach).toContain("<select");
    expect(scanCoach).toContain("options={tteViews.map");
    expect(scanCoach).toContain("options={fetalViews.map");
    expect(scanCoach).toContain("setSelectedTTE(nextView)");
    expect(scanCoach).toContain("setSelectedFetal(nextView)");
  });
});
