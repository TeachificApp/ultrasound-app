import { describe, expect, it } from "vitest";
import { extractExecuteRows } from "./routers/productAnalyticsRouter";

describe("product analytics SQL result normalization", () => {
  it("returns database row objects rather than mysql2 field metadata from a rows-fields tuple", () => {
    const rows = [{ transactionId: 12, amountPaid: 700, userName: "Member" }];
    const fields = [{ name: "transactionId" }];

    expect(extractExecuteRows([rows, fields])).toEqual(rows);
  });

  it("keeps an already-normalized Drizzle result row collection intact", () => {
    const rows = [{ total: 5, totalPaid: 4, totalRevenue: 2800 }];

    expect(extractExecuteRows(rows)).toEqual(rows);
  });
});
