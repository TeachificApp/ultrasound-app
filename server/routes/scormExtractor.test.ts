import { describe, expect, it } from "vitest";
import {
  canStartQueuedScormExtraction,
  nextScormStatusAfterInterruption,
  resolveScormWorkerDatabaseUrl,
  shouldUploadScormObject,
} from "./scormExtractor";

describe("SCORM extraction queue policy", () => {
  it("requeues interrupted extraction work instead of marking it skipped", () => {
    expect(nextScormStatusAfterInterruption()).toBe("pending");
  });

  it("starts a queued package only when no other extraction is active", () => {
    expect(canStartQueuedScormExtraction(0)).toBe(true);
    expect(canStartQueuedScormExtraction(1)).toBe(false);
  });

  it("selects Railway for managed Heartbeat extraction when the live media database is configured", () => {
    expect(resolveScormWorkerDatabaseUrl({ RAILWAY_MYSQL_URL: "mysql://railway.example/database" } as NodeJS.ProcessEnv))
      .toBe("mysql://railway.example/database");
    expect(resolveScormWorkerDatabaseUrl({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it("resumes a package by skipping R2 objects that were uploaded before interruption", () => {
    const existing = new Set(["scorm-extracted/example/index.html"]);
    expect(shouldUploadScormObject("scorm-extracted/example/index.html", existing)).toBe(false);
    expect(shouldUploadScormObject("scorm-extracted/example/data/slide.js", existing)).toBe(true);
  });
});
