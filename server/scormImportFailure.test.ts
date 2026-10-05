import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";
import {
  ScormImportStageError,
  classifyScormImportFailure,
  runScormImportStage,
} from "./lib/scormImportFailure";

describe("SCORM import failure classification", () => {
  it("returns a user-safe media preparation error without logging source details", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unsafe = new Error("storage://private-package/lesson-1.html for member@example.com");

    const classified = classifyScormImportFailure("preparing_media", unsafe);

    expect(classified).toBeInstanceOf(ScormImportStageError);
    expect(classified.code).toBe("INTERNAL_SERVER_ERROR");
    expect(classified.stage).toBe("preparing_media");
    expect(classified.message).toBe("SCORM import stopped while preparing associated images or videos. No Question Bank records were saved.");
    expect(log).toHaveBeenCalledWith("[QuestionBank] SCORM import stage=preparing_media failed (Error).");
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-package");
    expect(JSON.stringify(log.mock.calls)).not.toContain("member@example.com");
    log.mockRestore();
  });

  it("preserves the safe HTTP classification for expected import preconditions", async () => {
    await expect(runScormImportStage("reading_package", async () => {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "raw provider detail" });
    })).rejects.toMatchObject({
      stage: "reading_package",
      code: "PRECONDITION_FAILED",
      message: "SCORM import could not read the extracted package. Confirm extraction has completed, then try again.",
    });
  });

  it("preserves an already-classified failure stage", () => {
    const original = new ScormImportStageError("saving_questions", "BAD_REQUEST");
    expect(classifyScormImportFailure("preparing_media", original)).toBe(original);
  });
});
