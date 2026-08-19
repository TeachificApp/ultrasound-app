import { describe, expect, it } from "vitest";
import {
  MAINTENANCE_BANNER_EXPIRES_AT,
  shouldShowMaintenanceBanner,
} from "../shared/maintenanceBanner";

describe("maintenance banner visibility", () => {
  it("shows only to authenticated users before the August 25 Eastern expiry", () => {
    expect(shouldShowMaintenanceBanner({ isAuthenticated: true, isDismissed: false, now: MAINTENANCE_BANNER_EXPIRES_AT - 1 })).toBe(true);
    expect(shouldShowMaintenanceBanner({ isAuthenticated: false, isDismissed: false, now: MAINTENANCE_BANNER_EXPIRES_AT - 1 })).toBe(false);
  });

  it("stays hidden after dismissal and automatically expires at 9:00 AM Eastern", () => {
    expect(shouldShowMaintenanceBanner({ isAuthenticated: true, isDismissed: true, now: MAINTENANCE_BANNER_EXPIRES_AT - 1 })).toBe(false);
    expect(shouldShowMaintenanceBanner({ isAuthenticated: true, isDismissed: false, now: MAINTENANCE_BANNER_EXPIRES_AT })).toBe(false);
    expect(MAINTENANCE_BANNER_EXPIRES_AT).toBe(new Date("2026-08-25T09:00:00-04:00").getTime());
  });
});
