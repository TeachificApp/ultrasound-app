import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  NEW_RECORDING_WINDOW_MS,
  getCohortRecordingWatchStatus,
} from "../client/src/lib/cohortRecordingStatus";

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 9, 12, 0, 0);

describe("cohort recording watch status", () => {
  it("marks an unplayed recording as New for seven days after publication", () => {
    const status = getCohortRecordingWatchStatus(
      { publishedAt: new Date(NOW - (6 * 24 * HOUR)) },
      null,
      NOW,
    );

    expect(status).toEqual({ watched: false, isNew: true });
  });

  it("removes the New label after seven days when the recording remains unplayed", () => {
    const status = getCohortRecordingWatchStatus(
      { publishedAt: new Date(NOW - NEW_RECORDING_WINDOW_MS - 1) },
      null,
      NOW,
    );

    expect(status).toEqual({ watched: false, isNew: false });
  });

  it("marks a replay watched and clears New as soon as playback is recorded", () => {
    const status = getCohortRecordingWatchStatus(
      { createdAt: new Date(NOW - HOUR) },
      { playCount: 1, firstPlayedAt: new Date(NOW - 5 * 60 * 1000) },
      NOW,
    );

    expect(status).toEqual({ watched: true, isNew: false });
  });

  it("shows recording labels from existing learner progress in My Cohort", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/CourseOverview.tsx"), "utf8");

    expect(source).toContain("trpc.lmsLearner.getCohortRecordingProgress.useQuery");
    expect(source).toContain("getCohortRecordingWatchStatus(recording, progress)");
    expect(source).toContain("New recording — watch now");
    expect(source).toContain("Watched — watch again");
  });
});
