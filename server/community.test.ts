import { describe, it, expect } from "vitest";
import { isRichTextEmpty, appendHashtagsToBody } from "../shared/communityText";
import {
  buildNewestFeedNextCursor,
  parseNewestFeedCursor,
} from "../shared/communityFeed";
import {
  isLeaderboardExcludedEmail,
  COMMUNITY_LEADERBOARD_EXCLUDED_EMAILS,
  publicMemberDisplayName,
  isEmailLike,
} from "../shared/communityMember";

describe("communityText", () => {
  it("detects empty rich text", () => {
    expect(isRichTextEmpty("")).toBe(true);
    expect(isRichTextEmpty("<p></p>")).toBe(true);
    expect(isRichTextEmpty("<p><br></p>")).toBe(true);
    expect(isRichTextEmpty("<p>Hello</p>")).toBe(false);
  });

  it("appends hashtags to body", () => {
    const body = appendHashtagsToBody("<p>Test</p>", "echo, ultrasound");
    expect(body).toContain("#echo");
    expect(body).toContain("#ultrasound");
  });
});

describe("communityFeed pagination", () => {
  const d = (iso: string) => new Date(iso);

  it("builds unpinned cursor from last unpinned post on page", () => {
    const cursor = buildNewestFeedNextCursor(
      [
        { isPinned: true, createdAt: d("2024-01-01"), id: 100 },
        { isPinned: false, createdAt: d("2024-03-01"), id: 95 },
        { isPinned: false, createdAt: d("2024-02-01"), id: 90 },
      ],
      true,
    );
    expect(cursor).toEqual({
      type: "unpinned",
      createdAt: d("2024-02-01").toISOString(),
      id: 90,
    });
  });

  it("uses start_unpinned when page is all pinned", () => {
    const cursor = buildNewestFeedNextCursor(
      [{ isPinned: true, createdAt: d("2024-01-01"), id: 100 }],
      true,
    );
    expect(cursor).toEqual({ type: "start_unpinned" });
  });

  it("returns undefined when no more pages", () => {
    expect(buildNewestFeedNextCursor([], false)).toBeUndefined();
  });

  it("parses cursor objects from client", () => {
    expect(
      parseNewestFeedCursor({ type: "unpinned", createdAt: "2024-01-01T00:00:00.000Z", id: 5 })?.type,
    ).toBe("unpinned");
    expect(parseNewestFeedCursor({ type: "start_unpinned" })?.type).toBe("start_unpinned");
  });
});

describe("community leaderboard exclusions", () => {
  it("flags staff emails as leaderboard-excluded", () => {
    for (const email of COMMUNITY_LEADERBOARD_EXCLUDED_EMAILS) {
      expect(isLeaderboardExcludedEmail(email)).toBe(true);
      expect(isLeaderboardExcludedEmail(email.toUpperCase())).toBe(true);
    }
    expect(isLeaderboardExcludedEmail("member@example.com")).toBe(false);
  });
});

describe("publicMemberDisplayName", () => {
  it("returns username from email when no real name is set", () => {
    expect(publicMemberDisplayName({ name: "user@example.com" })).toBe("user");
    expect(publicMemberDisplayName({ name: "john.doe@hospital.org" })).toBe("john.doe");
  });
  it("returns real name when available, ignoring email fallback", () => {
    expect(publicMemberDisplayName({ displayName: "Jane Doe", name: "jane@example.com" })).toBe("Jane Doe");
  });
  it("strips Thinkific merge prefixes from names", () => {
    expect(publicMemberDisplayName({ name: "[Merged into #5940650] Chris Layman" })).toBe("Chris Layman");
    expect(publicMemberDisplayName({ displayName: "[Merged into #123] Alice" })).toBe("Alice");
  });
  it("falls back to Member when no name or email is provided", () => {
    expect(publicMemberDisplayName({})).toBe("Member");
    expect(publicMemberDisplayName({ name: null })).toBe("Member");
  });
  it("isEmailLike correctly identifies emails", () => {
    expect(isEmailLike("test@foo.com")).toBe(true);
    expect(isEmailLike("not-an-email")).toBe(false);
  });
});
