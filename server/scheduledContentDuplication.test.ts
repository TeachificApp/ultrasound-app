import { describe, expect, it } from "vitest";
import { duplicateScheduleFromStart, shiftDateFromStart } from "../shared/scheduledContentDuplication";

describe("scheduled content duplication timing", () => {
  it("preserves date offsets from a new scheduled start", () => {
    const oldStart = new Date("2026-01-10T14:00:00.000Z");
    const newStart = new Date("2026-06-01T14:00:00.000Z");
    const due = new Date("2026-01-15T17:30:00.000Z");
    expect(shiftDateFromStart(due, oldStart, newStart)?.toISOString()).toBe("2026-06-06T17:30:00.000Z");
  });

  it("shifts group close/end dates while retaining the selected start", () => {
    const schedule = duplicateScheduleFromStart({
      startDate: "2026-01-10T09:00:00.000Z",
      endDate: "2026-01-20T09:00:00.000Z",
      enrollmentCloseDate: "2026-01-08T09:00:00.000Z",
    }, "2026-04-01T09:00:00.000Z");
    expect(schedule.startDate.toISOString()).toBe("2026-04-01T09:00:00.000Z");
    expect(schedule.endDate?.toISOString()).toBe("2026-04-11T09:00:00.000Z");
    expect(schedule.enrollmentCloseDate?.toISOString()).toBe("2026-03-30T09:00:00.000Z");
  });

  it("retains an independent date when the source has no usable start date", () => {
    const independent = new Date("2026-08-03T12:00:00.000Z");
    expect(shiftDateFromStart(independent, null, "2026-06-01T14:00:00.000Z")?.toISOString()).toBe(independent.toISOString());
  });
});
