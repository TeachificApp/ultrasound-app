import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CmeManagementTab", () => {
  const source = readFileSync(resolve(import.meta.dirname, "CmeManagementTab.tsx"), "utf8");

  it("exposes activity selection, certificate oversight, and a CSV export action", () => {
    expect(source).toContain("CME Management");
    expect(source).toContain("Certificate Management");
    expect(source).toContain("Certificates outstanding");
    expect(source).toContain("Export activity CSV");
    expect(source).toContain("exportCmeManagementActivityCsv");
  });

  it("keeps large learner reports paginated and shows quiz and survey records", () => {
    expect(source).toContain("pageSize: 50");
    expect(source).toContain("Showing {Math.min");
    expect(source).toContain("View recorded results");
    expect(source).toContain("Survey and quiz results");
  });
});
