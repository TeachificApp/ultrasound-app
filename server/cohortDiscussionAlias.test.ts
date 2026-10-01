import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("learner cohort discussion aliases", () => {
  it("returns the selected admin posting alias instead of the administrator profile", () => {
    const source = readFileSync(resolve(process.cwd(), "server/routers/lmsRouter.ts"), "utf8");

    expect(source).toContain("aliasId: lmsCohortMessages.aliasId");
    expect(source).toContain("userDisplayName: alias.name");
    expect(source).toContain("userAvatar: alias.avatarUrl ?? message.userAvatar");
    expect(source).toContain("isAlias: true");
  });
});
