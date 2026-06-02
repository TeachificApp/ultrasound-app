import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  signMediaViewerToken,
  verifyMediaViewerToken,
  buildMediaAuthQuery,
} from "./mediaEmbedAccess";

describe("mediaEmbedAccess", () => {
  const prevSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
  });

  afterEach(() => {
    process.env.JWT_SECRET = prevSecret;
  });

  it("signs and verifies a viewer token for a slug", () => {
    const access = signMediaViewerToken("my-scorm-quiz", 42, 7);
    const parsed = verifyMediaViewerToken(access, "my-scorm-quiz");
    expect(parsed).toEqual({ userId: 42, courseId: 7 });
  });

  it("rejects token for wrong slug", () => {
    const access = signMediaViewerToken("slug-a", 1);
    expect(verifyMediaViewerToken(access, "slug-b")).toBeNull();
  });

  it("builds auth query with token and access", () => {
    expect(buildMediaAuthQuery({ token: "abc", access: "xyz" })).toBe(
      "?token=abc&access=xyz"
    );
    expect(buildMediaAuthQuery({})).toBe("");
  });
});
