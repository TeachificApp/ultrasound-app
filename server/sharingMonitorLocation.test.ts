import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("authorized IP location and export handling", () => {
  it("stores complete location and network metadata without destructive schema changes", () => {
    const schema = readProjectFile("drizzle/schema.ts");
    const migration = readProjectFile("drizzle/0066_ip_access_log_location.sql");

    for (const field of ["geoCountry", "geoRegion", "geoCity", "geoPostalCode", "geoLatitude", "geoLongitude", "geoTimezone", "geoIsp", "geoOrganization", "geoAsn", "geoResolvedAt"]) {
      expect(schema).toContain(field);
    }
    expect(migration).toContain("ALTER TABLE `ip_access_logs`");
    expect(migration).not.toMatch(/\bDROP\b|\bDELETE\b/i);
  });

  it("keeps IP resolution and full export behind the existing administrator guard", () => {
    const router = readProjectFile("server/routers/sharingMonitorRouter.ts");
    const location = readProjectFile("server/lib/ipLocation.ts");
    const view = readProjectFile("client/src/pages/admin/SharingMonitor.tsx");

    expect(router).toContain("resolveUserIpLocations: protectedProcedure");
    expect(router).toContain("assertAdmin(ctx);");
    expect(router).toContain("enrichMissingUserIpLocations(input.userId, 25)");
    expect(router).toContain("Country,Region,City,Postal Code,Latitude,Longitude,Timezone,ISP,Organization,ASN");
    expect(router).toContain("const csvCell");
    expect(location).toContain("https://ipwho.is/");
    expect(location).toContain("AbortSignal.timeout(4000)");
    expect(readProjectFile("server/jobs/sharingMonitor.ts")).toContain("IP location enrichment unavailable");
    expect(view).toContain("Resolve missing locations");
    expect(view).toContain("formatIpLocation");
    expect(view).toContain("Export CSV");
  });
});
