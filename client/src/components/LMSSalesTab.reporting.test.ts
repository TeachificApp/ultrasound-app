import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const salesTab = readFileSync(resolve(process.cwd(), "client/src/components/LMSSalesTab.tsx"), "utf8");

describe("LMS Sales reporting amount contract", () => {
  it("formats stored order cents with the shared cents formatter", () => {
    expect(salesTab).toContain('import { formatCentsAsCurrency } from "@/lib/formatMoney"');
    expect(salesTab).toContain("formatCentsAsCurrency(o.amount, o.currency)");
    expect(salesTab).toContain("formatCentsAsCurrency(data.totalRevenue)");
    expect(salesTab).not.toContain("function fmtMoney(");
  });
});
