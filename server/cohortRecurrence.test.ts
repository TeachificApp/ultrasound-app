import { describe, expect, it } from "vitest";
import { expandCohortRecurrence, getLocalWeekday } from "./server/lib/cohortRecurrence";

const TZ = "America/New_York";

function makeParent(overrides: Partial<Parameters<typeof expandCohortRecurrence>[0]> = {}) {
  return {
    id: 1,
    courseId: 10,
    cohortGroupId: null,
    title: "Live Session",
    description: null,
    // Tuesday Jan 7, 2025 7:30 PM ET (stored as UTC — next calendar day in UTC)
    sessionDate: new Date("2025-01-08T00:30:00.000Z"),
    durationMinutes: 60,
    meetingUrl: "https://zoom.us/j/test",
    status: "published" as const,
    timezone: TZ,
    recurrenceRule: "weekly" as const,
    recurrenceDaysOfWeek: "2,3,4", // Tue, Wed, Thu
    recurrenceEndDate: null,
    recurrenceOccurrenceCount: 10,
    ...overrides,
  };
}

describe("expandCohortRecurrence", () => {
  it("generates only Tue/Wed/Thu for weekly recurrence (not Mon or other days)", () => {
    const instances = expandCohortRecurrence(makeParent());
    expect(instances.length).toBeGreaterThan(0);

    const weekdays = new Set(instances.map(i => getLocalWeekday(i.sessionDate, TZ)));
    expect(weekdays.has(1)).toBe(false); // Monday
    expect(weekdays.has(5)).toBe(false); // Friday
    expect(weekdays.has(6)).toBe(false); // Saturday
    expect(weekdays.has(0)).toBe(false); // Sunday

    for (const inst of instances) {
      const dow = getLocalWeekday(inst.sessionDate, TZ);
      expect([2, 3, 4]).toContain(dow);
    }
  });

  it("preserves local time-of-day in session timezone", () => {
    const instances = expandCohortRecurrence(makeParent());
    for (const inst of instances) {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      }).formatToParts(inst.sessionDate);
      const h = parseInt(parts.find(p => p.type === "hour")?.value ?? "0", 10) % 24;
      const m = parseInt(parts.find(p => p.type === "minute")?.value ?? "0", 10);
      expect(h).toBe(19);
      expect(m).toBe(30);
    }
  });

  it("does not create instances on or before the parent session", () => {
    const parent = makeParent();
    const instances = expandCohortRecurrence(parent);
    for (const inst of instances) {
      expect(inst.sessionDate.getTime()).toBeGreaterThan(parent.sessionDate.getTime());
    }
  });

  it("respects occurrence count", () => {
    const instances = expandCohortRecurrence(makeParent({ recurrenceOccurrenceCount: 4 }));
    expect(instances).toHaveLength(3); // parent counts as 1; 3 more children
  });

  it("biweekly repeats on selected days every two weeks", () => {
    const instances = expandCohortRecurrence(
      makeParent({ recurrenceRule: "biweekly", recurrenceOccurrenceCount: 7 }),
    );
    const dates = instances.map(i =>
      new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(i.sessionDate),
    );
    // First week after parent Tue Jan 7: Wed Jan 8, Thu Jan 9
    expect(dates).toContain("2025-01-08");
    expect(dates).toContain("2025-01-09");
    // Next Tue in series is Jan 14 (one week later) — biweekly means Jan 21
    expect(dates).toContain("2025-01-21");
    expect(dates).not.toContain("2025-01-14"); // not a biweekly Tuesday slot
  });

  it("handles evening sessions without UTC weekday shift (regression)", () => {
    // 9 PM ET on Tuesday — UTC is Wednesday 02:00
    const parent = makeParent({
      sessionDate: new Date("2025-03-12T01:00:00.000Z"), // Tue Mar 11 9PM EDT? check...
      recurrenceDaysOfWeek: "2",
      recurrenceOccurrenceCount: 3,
    });
    // Mar 11 2025 is Tuesday in US
    const instances = expandCohortRecurrence(parent);
    expect(instances.length).toBeGreaterThan(0);
    for (const inst of instances) {
      expect(getLocalWeekday(inst.sessionDate, TZ)).toBe(2);
    }
  });
});
