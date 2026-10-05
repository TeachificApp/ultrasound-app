import { describe, expect, it } from "vitest";
import { getAiSourceUploadDecision, isSupportedAiSourceMimeType } from "./lib/aiSourceFile";

describe("AI source upload validation", () => {
  it("accepts supported PDF document and image source MIME types", () => {
    expect(isSupportedAiSourceMimeType("application/pdf")).toBe(true);
    expect(isSupportedAiSourceMimeType("application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe(true);
    expect(isSupportedAiSourceMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
    expect(isSupportedAiSourceMimeType("image/jpeg")).toBe(true);
    expect(isSupportedAiSourceMimeType("image/png")).toBe(true);
    expect(isSupportedAiSourceMimeType("image/webp")).toBe(true);
  });

  it("rejects unsupported files before storage or model use", () => {
    expect(isSupportedAiSourceMimeType("image/svg+xml")).toBe(false);
    expect(isSupportedAiSourceMimeType("application/zip")).toBe(false);
    expect(isSupportedAiSourceMimeType(undefined)).toBe(false);
  });

  it("rejects non-admin upload attempts and accepts an authenticated administrator with a supported source", () => {
    expect(getAiSourceUploadDecision(null, "application/pdf")).toMatchObject({ allowed: false, status: 401 });
    expect(getAiSourceUploadDecision({ role: "user" }, "image/png")).toMatchObject({ allowed: false, status: 401 });
    expect(getAiSourceUploadDecision({ role: "admin" }, "application/zip")).toMatchObject({ allowed: false, status: 400 });
    expect(getAiSourceUploadDecision({ role: "admin" }, "application/pdf")).toEqual({ allowed: true, status: 200, error: null });
    expect(getAiSourceUploadDecision({ role: "admin" }, "", "flashcard-template.pptx")).toEqual({ allowed: true, status: 200, error: null });
  });
});
