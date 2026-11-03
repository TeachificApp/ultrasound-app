import { describe, expect, it, vi } from "vitest";
import { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { ultrasoundExpoPackages } from "../../drizzle/schema";
import { listCompatibleExpoPackages, normalizeLegacyExpoEvent } from "./expoEventSchemaCompatibility";

describe("Expo event schema compatibility", () => {
  it("treats a legacy row without the additive tenant column as UltrasoundExpo™", () => {
    expect(normalizeLegacyExpoEvent({ id: 12, name: "Annual Expo" }, false)).toMatchObject({
      id: 12,
      name: "Annual Expo",
      tenant: "ultrasound_expo",
    });
  });

  it("retains an explicit EchoExpo™ tenant only after the additive schema is available", () => {
    expect(normalizeLegacyExpoEvent({ id: 13, tenant: "echo_expo" }, true).tenant).toBe("echo_expo");
    expect(normalizeLegacyExpoEvent({ id: 13, tenant: "echo_expo" }, false).tenant).toBe("ultrasound_expo");
  });

  it.each([false, true])("keeps packages readable when combined-offer column availability is %s", async (hasColumn) => {
    const packages = [{ id: 7, eventId: 1, name: "Existing option", amountCents: 250000, combinedWithPackageId: hasColumn ? 8 : null }];
    const db = {
      execute: vi.fn().mockResolvedValue([hasColumn ? [{ COLUMN_NAME: "combined_with_package_id" }] : [], []]),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(packages) }),
      }),
    };
    expect(await listCompatibleExpoPackages(db)).toEqual(packages);
    const projection = db.select.mock.calls[0][0];
    expect(projection.id).toBe(ultrasoundExpoPackages.id);
    expect(projection.name).toBe(ultrasoundExpoPackages.name);
    expect(projection.amountCents).toBe(ultrasoundExpoPackages.amountCents);
    if (hasColumn) {
      expect(projection.combinedWithPackageId).toBe(ultrasoundExpoPackages.combinedWithPackageId);
    } else {
      expect(projection.combinedWithPackageId).toBeInstanceOf(SQL);
      expect(new MySqlDialect().sqlToQuery(projection.combinedWithPackageId).sql).toBe("NULL");
    }
  });
});
