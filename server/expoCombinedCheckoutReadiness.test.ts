import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { SQL } from "drizzle-orm";
import { EXPO_COMBINED_GROUP_COLUMNS, EXPO_COMBINED_SCHEMA_ADDITIONS } from "./lib/expoCombinedOfferSchema";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getUserRoles: vi.fn(), getStripeClient: vi.fn(), requireApprovedVendorApplication: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb, getUserRoles: mocks.getUserRoles }));
vi.mock("./lib/stripeClient", () => ({ getStripeClient: mocks.getStripeClient }));
vi.mock("./lib/vendorPartnerAccess", () => ({ requireApprovedVendorApplication: mocks.requireApprovedVendorApplication }));
import { ultrasoundExpoRouter } from "./routers/ultrasoundExpoRouter";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApprovedVendorApplication.mockResolvedValue({ id: 4 });
});
const input = { primaryPackageId: 10, companionPackageId: 20, origin: "https://ultrasoundexpo.com" };
const caller = (authenticated = true) => ultrasoundExpoRouter.createCaller({ user: authenticated ? { id: 7, role: "user" } : null, req: {}, res: {} } as any);

describe("Combined Expo checkout migration readiness", () => {
  it.each(["unmigrated", "pairing-column-only", "missing-indexes", "metadata-unavailable"])("fails before Stripe or row writes when %s", async mode => {
    const dialect = new MySqlDialect();
    const db = { execute: vi.fn(async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement).sql;
      expect(query).toMatch(/^SELECT/);
      expect(query).toContain("INFORMATION_SCHEMA");
      if (mode === "metadata-unavailable") throw new Error("Synthetic private database details");
      if (query.includes("STATISTICS")) return [[], []];
      const columns = mode === "missing-indexes"
        ? [...EXPO_COMBINED_GROUP_COLUMNS.map(([column, type, nullable]) => ({ TABLE_NAME: "ultrasound_expo_checkout_groups", COLUMN_NAME: column, DATA_TYPE: type, IS_NULLABLE: nullable })), ...EXPO_COMBINED_SCHEMA_ADDITIONS.flatMap(addition => addition.kind === "column" ? [{ TABLE_NAME: addition.table, COLUMN_NAME: addition.column, DATA_TYPE: "int", IS_NULLABLE: "YES" }] : [])]
        : mode === "pairing-column-only" ? [{ TABLE_NAME: "ultrasound_expo_packages", COLUMN_NAME: "combined_with_package_id", DATA_TYPE: "int", IS_NULLABLE: "YES" }] : [];
      return [columns, []];
    }), select: vi.fn(), insert: vi.fn(), update: vi.fn() };
    mocks.getDb.mockResolvedValue(db);
    await expect(caller().createCombinedPartnerCheckout(input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("No payment was started") });
    expect(mocks.requireApprovedVendorApplication).toHaveBeenCalledWith(7, "ultrasound_expo");
    expect(db.select).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(mocks.getStripeClient).not.toHaveBeenCalled();
  });

  it("preserves approval gating before looking up the migration or Stripe", async () => {
    mocks.requireApprovedVendorApplication.mockRejectedValue(new Error("Not approved"));
    await expect(caller().createCombinedPartnerCheckout(input)).rejects.toThrow("Not approved");
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.getStripeClient).not.toHaveBeenCalled();
  });

  it("preserves authentication before querying or creating partner checkout", async () => {
    await expect(caller(false).createCombinedPartnerCheckout(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.requireApprovedVendorApplication).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});
