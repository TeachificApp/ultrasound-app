import { describe, it, expect } from "vitest";
import { isRichTextEmpty, appendHashtagsToBody } from "../shared/communityText";
import {
  buildNewestFeedNextCursor,
  parseNewestFeedCursor,
} from "../shared/communityFeed";

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
