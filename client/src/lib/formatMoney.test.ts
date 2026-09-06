import { describe, expect, it } from "vitest";
import { formatCentsAsCurrency } from "./formatMoney";

describe("formatCentsAsCurrency", () => {
  it("renders integer-cent order amounts as dollars instead of raw cents", () => {
    expect(formatCentsAsCurrency(2997)).toBe("$29.97");
  });

  it("preserves zero and rejects invalid amount values safely", () => {
    expect(formatCentsAsCurrency(0)).toBe("$0.00");
    expect(formatCentsAsCurrency("not-a-number")).toBe("—");
  });
});
