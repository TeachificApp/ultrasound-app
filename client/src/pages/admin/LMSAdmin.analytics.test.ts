import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const lmsAdmin = readFileSync(resolve(process.cwd(), "client/src/pages/admin/LMSAdmin.tsx"), "utf8");

describe("LMS Analytics reporting", () => {
  it("formats aggregate revenue as cents and exposes an explicit retryable error state", () => {
    expect(lmsAdmin).toContain("value: formatCentsAsCurrency(data.totalRevenue)");
    expect(lmsAdmin).toContain("Analytics could not load.");
    expect(lmsAdmin).toContain("void refetch()");
    expect(lmsAdmin).toContain("ordersError ?");
  });
});
