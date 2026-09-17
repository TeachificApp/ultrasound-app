import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("Sharing Monitor protected student detail fallback", () => {
  it("keeps student detail available when only additive IP-location columns are unavailable", () => {
    const router = readProjectFile("server/routers/sharingMonitorRouter.ts");

    expect(router).toContain("function isMissingIpLocationColumn");
    expect(router).toContain("if (!isMissingIpLocationColumn(error)) throw error;");
    expect(router).toContain("ipLocationDataAvailable = false");
    expect(router).toContain("ipLocationDataAvailable");
    expect(router).toContain("geoLookupStatus");
    expect(router).toContain("userRow) throw new TRPCError({ code: \"NOT_FOUND\", message: \"User not found\" })");
  });

  it("does not mislabel a protected detail-query failure as a missing user", () => {
    const client = readProjectFile("client/src/pages/admin/SharingMonitor.tsx");

    expect(client).toContain("detail.isError");
    expect(client).toContain("Unable to load this student’s access detail right now.");
    expect(client).toContain("onClick={() => detail.refetch()}");
  });
});
