import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { selectCurrentCohortGroupId } from "./lib/cohortGroupQuery";

const NOW = new Date("2026-09-28T12:00:00.000Z");

describe("cohort group selection", () => {
  it("prefers the group currently in progress over a future group", () => {
    expect(
      selectCurrentCohortGroupId(
        [
          {
            id: 120001,
            startDate: "2026-09-01T00:00:00.000Z",
            endDate: "2026-11-20T23:59:59.000Z",
            status: "open",
          },
          {
            id: 120002,
            startDate: "2027-01-05T00:00:00.000Z",
            endDate: "2027-03-31T23:59:59.000Z",
            status: "open",
          },
        ],
        NOW
      )
    ).toBe(120001);
  });

  it("falls forward to the next upcoming group when no group is active", () => {
    expect(
      selectCurrentCohortGroupId(
        [
          {
            id: 120001,
            startDate: "2026-01-01T00:00:00.000Z",
            endDate: "2026-02-01T23:59:59.000Z",
            status: "completed",
          },
          {
            id: 120002,
            startDate: "2027-01-05T00:00:00.000Z",
            endDate: "2027-03-31T23:59:59.000Z",
            status: "open",
          },
        ],
        NOW
      )
    ).toBe(120002);
  });

  it("requires an explicit group or current-group fallback for admin preview schedules", async () => {
    const source = await readFile(
      new URL("./routers/lmsRouter.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain(
      "cohortGroupId: z.number().int().positive().optional()"
    );
    expect(source).toContain("selectCurrentCohortGroupId(groups)");
    expect(source).toContain(
      "(!isAdmin ? myGroupEnrollment?.cohortGroupId : undefined)"
    );
    expect(source).toContain(
      "const groupId = course.multiCohortMode && myGroup ? myGroup.id : null"
    );
  });
});
