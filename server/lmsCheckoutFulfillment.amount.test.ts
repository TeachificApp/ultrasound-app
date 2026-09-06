import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("LMS order amount persistence", () => {
  it("stores a created checkout order and Stripe fulfillment amount in cents", () => {
    const lmsRouter = readFileSync(resolve(process.cwd(), "server/routers/lmsRouter.ts"), "utf8");
    const fulfillment = readFileSync(resolve(process.cwd(), "server/lib/lmsCheckoutFulfillment.ts"), "utf8");
    expect(lmsRouter).toContain("amount: Math.round(Number(orderAmount) * 100)");
    expect(fulfillment).toContain("...(amountTotal > 0 ? { amount: amountTotal } : {})");
  });
});
