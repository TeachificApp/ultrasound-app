import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "client/src/pages/admin/AdminUserDetailPage.tsx"),
  "utf8",
);

describe("administrator member Downloads tab badge", () => {
  it("counts both LMS download enrollments and digital file purchases", () => {
    expect(source).toContain("const digitalPurchases = data.digitalPurchases ?? [];");
    expect(source).toContain("const downloadAccessCount = downloads.length + digitalPurchases.length;");
    expect(source).toContain('key: "downloads",    label: "Downloads",    icon: Download,       count: downloadAccessCount');
    expect(source).toContain("title={`Downloads (${downloadAccessCount})`}");
  });

  it("uses the same unified count for empty state and purchased file rendering", () => {
    expect(source).toContain("{digitalPurchases.length > 0 && (");
    expect(source).toContain("{digitalPurchases.map((d: any) => (");
    expect(source).toContain("{downloadAccessCount === 0 ? (");
  });
});
