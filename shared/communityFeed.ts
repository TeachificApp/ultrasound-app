/**
 * Community feed pagination helpers (newest sort with pinned posts).
 */

export type NewestFeedCursor =
  | { type: "unpinned"; createdAt: string; id: number }
  | { type: "start_unpinned" };

export function buildNewestFeedNextCursor(
  posts: Array<{ isPinned: boolean; createdAt: Date; id: number }>,
  hasMore: boolean,
): NewestFeedCursor | undefined {
  if (!hasMore || posts.length === 0) return undefined;
  const lastUnpinned = [...posts].reverse().find((p) => !p.isPinned);
  if (lastUnpinned) {
    return {
      type: "unpinned",
      createdAt: lastUnpinned.createdAt.toISOString(),
      id: lastUnpinned.id,
    };
  }
  return { type: "start_unpinned" };
}

export function parseNewestFeedCursor(raw: unknown): NewestFeedCursor | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  if (c.type === "start_unpinned") return { type: "start_unpinned" };
  if (
    c.type === "unpinned" &&
    typeof c.createdAt === "string" &&
    typeof c.id === "number"
  ) {
    return { type: "unpinned", createdAt: c.createdAt, id: c.id };
  }
  return undefined;
}

/** @deprecated Legacy numeric id cursor — treat as start of unpinned feed */
export function legacyNumericCursor(raw: unknown): number | undefined {
  return typeof raw === "number" ? raw : undefined;
}
