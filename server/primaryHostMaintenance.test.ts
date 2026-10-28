import { describe, expect, it } from "vitest";
import { shouldRunPrimaryHostMaintenance } from "./lib/primaryHostMaintenance";

describe("shouldRunPrimaryHostMaintenance", () => {
  it("keeps recurring jobs off an unmanaged publish container by default", () => {
    expect(shouldRunPrimaryHostMaintenance({})).toBe(false);
  });

  it("keeps recurring jobs on the designated Railway primary host", () => {
    expect(shouldRunPrimaryHostMaintenance({ RAILWAY_PRIMARY: "true" })).toBe(true);
  });

  it("allows an explicitly configured dedicated worker outside Railway", () => {
    expect(
      shouldRunPrimaryHostMaintenance({
        RAILWAY_PRIMARY: "false",
        ENABLE_IN_PROCESS_BACKGROUND_JOBS: "true",
      }),
    ).toBe(true);
  });

  it("does not run maintenance on a Railway non-primary replica", () => {
    expect(
      shouldRunPrimaryHostMaintenance({
        RAILWAY_ENVIRONMENT: "production",
        RAILWAY_PRIMARY: "false",
      }),
    ).toBe(false);
  });
});
