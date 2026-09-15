import { describe, expect, it } from "vitest";
import { scheduleEnsureFreeMembership } from "./lib/ensureFreeMembership";

describe("ensureFreeMembership scheduling", () => {
  it("accepts valid user ids without throwing", () => {
    expect(() => scheduleEnsureFreeMembership(1)).not.toThrow();
    expect(() => scheduleEnsureFreeMembership(0)).not.toThrow();
    expect(() => scheduleEnsureFreeMembership(-1)).not.toThrow();
  });
});
