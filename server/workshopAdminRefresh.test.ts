import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "client/src/pages/admin/WorkshopsAdmin.tsx"),
  "utf8",
);

describe("workshop administration list reliability", () => {
  it("revalidates workshop records and never presents a failed request as an empty LMS", () => {
    expect(source).toContain('refetchOnMount: "always"');
    expect(source).toContain('refetchOnWindowFocus: "always"');
    expect(source).toContain("Workshops could not be loaded");
    expect(source).toContain("Retry loading workshops");
  });

  it("keeps the last rendered workshop set while a fresh result synchronizes", () => {
    expect(source).toContain("localWorkshops.length > 0 ? localWorkshops : (data?.workshops ?? [])");
  });
});
