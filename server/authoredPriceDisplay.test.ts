import { describe, expect, it } from "vitest";
import { formatAuthoredDollars } from "../shared/authoredPriceDisplay";

describe("authored price display", () => {
  it("keeps explicitly authored cents visible for cohort and course offers", () => {
    expect(formatAuthoredDollars("2297.00")).toBe("$2,297.00");
    expect(formatAuthoredDollars("22.97")).toBe("$22.97");
  });

  it("does not force cents onto a whole-dollar price", () => {
    expect(formatAuthoredDollars("2297")).toBe("$2,297");
  });
});
