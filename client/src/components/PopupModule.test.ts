import { describe, expect, it } from "vitest";
import { isPopupScheduleActive, popupDurationMs } from "./PopupModule";

const NOW = Date.parse("2028-01-15T12:00:00.000Z");

describe("PopupModule scheduling", () => {
  it("does not render disabled popups", () => {
    expect(isPopupScheduleActive({ enabled: false }, NOW)).toBe(false);
  });

  it("supports before and after date rules", () => {
    expect(isPopupScheduleActive({ scheduleMode: "before", endAt: "2028-01-15T12:00:00.000Z" }, NOW)).toBe(true);
    expect(isPopupScheduleActive({ scheduleMode: "before", endAt: "2028-01-15T11:59:59.999Z" }, NOW)).toBe(false);
    expect(isPopupScheduleActive({ scheduleMode: "after", startAt: "2028-01-15T12:00:00.000Z" }, NOW)).toBe(true);
    expect(isPopupScheduleActive({ scheduleMode: "after", startAt: "2028-01-15T12:00:00.001Z" }, NOW)).toBe(false);
  });

  it("supports inclusive date windows with an open boundary", () => {
    expect(isPopupScheduleActive({
      scheduleMode: "between",
      startAt: "2028-01-15T12:00:00.000Z",
      endAt: "2028-01-15T12:00:00.000Z",
    }, NOW)).toBe(true);
    expect(isPopupScheduleActive({ scheduleMode: "between", startAt: "2028-01-15T12:00:00.001Z" }, NOW)).toBe(false);
    expect(isPopupScheduleActive({ scheduleMode: "between", endAt: "2028-01-15T11:59:59.999Z" }, NOW)).toBe(false);
  });

  it("clamps automatic close durations and leaves zero as visitor-dismissed", () => {
    expect(popupDurationMs({ displayDurationSeconds: 0 })).toBe(0);
    expect(popupDurationMs({ displayDurationSeconds: -5 })).toBe(0);
    expect(popupDurationMs({ displayDurationSeconds: 3.5 })).toBe(4_000);
    expect(popupDurationMs({ displayDurationSeconds: 99_999 })).toBe(86_400_000);
  });
});
