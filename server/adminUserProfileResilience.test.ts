import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("administrator member profile resilience", () => {
  it("keeps purchaser-history reads supplemental to the member profile", () => {
    const source = readFileSync("server/routers/adminUserRouter.ts", "utf8");
    const start = source.indexOf("let privatePurchasePayees");
    const end = source.indexOf("// Digital product purchases", start);
    const purchaserHistoryBlock = source.slice(start, end);

    expect(purchaserHistoryBlock).toContain("try {");
    expect(purchaserHistoryBlock).toContain("catch (purchasePayeeReadError)");
    expect(purchaserHistoryBlock).toContain("never make every administrator member profile unavailable");
  });
});
