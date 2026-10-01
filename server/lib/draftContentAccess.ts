import { TRPCError } from "@trpc/server";
import { isPlatformAdminUser } from "./singleDeviceSession";

/**
 * Draft sales and landing content is never public. A platform administrator can
 * still retrieve it through the regular landing URL for review, but a client
 * query parameter must never grant that privilege.
 */
type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;
type Viewer = { id: number; role: string } | null | undefined;

export async function canPreviewDraftContent(db: Db, viewer: Viewer): Promise<boolean> {
  if (!viewer) return false;
  return isPlatformAdminUser(db, viewer);
}

/** Throws an intentionally non-enumerating response for unavailable public content. */
export function throwUnavailableDraftContent(): never {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: "This content is currently unavailable.",
  });
}
