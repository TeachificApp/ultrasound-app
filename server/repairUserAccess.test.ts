import { describe, expect, it } from "vitest";

describe("repairUserAccess wiring", () => {
  it("exports shared repair helper", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./lib/repairUserAccess.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("export async function repairUserAccess");
    expect(source).toContain("clearSendGridSuppressionLists");
    expect(source).toContain("regenerateAccessToken");
  });

  it("exposes adminUser.repairUserAccess for platform admins", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./routers/adminUserRouter.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("repairUserAccess: protectedProcedure");
  });
});
