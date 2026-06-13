/**
 * communityAutoJoin.ts
 * Shared helper that fires community workflow rules for a given trigger event.
 * Called from:
 *   - upsertUser (any_signup)
 *   - Stripe webhook checkout.session.completed (any_purchase, course_enrollment, etc.)
 */
import { getDb } from "../db";
import { communityWorkflowRules, communityMembers } from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

export type CommunityTrigger =
  | { type: "any_signup" }
  | { type: "any_purchase" }
  | { type: "course_enrollment"; entityId: number }
  | { type: "webinar_registration"; entityId: number }
  | { type: "download_purchase"; entityId: number }
  | { type: "bundle_purchase"; entityId: number }
  | { type: "brand_membership" };

/**
 * Evaluate all active workflow rules for the given trigger and add the user
 * to any matching communities (silently — no welcome email, no XP award).
 */
export async function fireCommunityWorkflowRules(
  userId: number,
  trigger: CommunityTrigger,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    // Find all active rules matching this trigger type
    const matchingRules = await db
      .select()
      .from(communityWorkflowRules)
      .where(
        and(
          eq(communityWorkflowRules.triggerType, trigger.type as any),
          eq(communityWorkflowRules.isActive, true),
        ),
      );

    if (!matchingRules.length) return;

    for (const rule of matchingRules) {
      // For entity-specific triggers, only fire if entityId matches
      if (
        "entityId" in trigger &&
        rule.entityId !== null &&
        rule.entityId !== trigger.entityId
      ) {
        continue;
      }

      // Check if user is already a member
      const existing = await db
        .select({ id: communityMembers.id })
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, rule.communityId),
            eq(communityMembers.userId, userId),
          ),
        )
        .limit(1);

      if (existing.length > 0) continue; // already a member

      await db.insert(communityMembers).values({
        communityId: rule.communityId,
        userId,
        role: "member",
        memberStatus: "approved",
      });
      console.log(
        `[CommunityAutoJoin] User ${userId} added to community ${rule.communityId} via rule "${rule.name}" (trigger: ${trigger.type})`,
      );
    }
  } catch (err) {
    // Non-blocking — log but don't throw
    console.error("[CommunityAutoJoin] Error firing workflow rules:", err);
  }
}
