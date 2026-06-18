/**
 * communityAutoJoin.ts
 * Shared helper that fires community workflow rules for a given trigger event.
 * Called from:
 *   - upsertUser (any_signup)
 *   - Stripe webhook checkout.session.completed (any_purchase, course_enrollment, etc.)
 *
 * Also handles the "linked" accessType: communities whose linkedAccessItems JSON
 * contains the purchased product are auto-joined by the buyer.
 */
import { getDb } from "../db";
import { communityWorkflowRules, communityMembers, communities, communityCourseLinkages } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export type CommunityTrigger =
  | { type: "any_signup" }
  | { type: "any_purchase" }
  | { type: "course_enrollment"; entityId: number }
  | { type: "webinar_registration"; entityId: number }
  | { type: "download_purchase"; entityId: number }
  | { type: "bundle_purchase"; entityId: number }
  | { type: "brand_membership" }
  | { type: "membership_subscription"; entityId: number };

/**
 * Map trigger types to linkedAccessItems product types.
 * course_enrollment covers both "course" and "quiz" types since quizzes are
 * stored as lmsCourses with type="quiz" and use the same enrollment table.
 */
const TRIGGER_TO_PRODUCT_TYPES: Partial<Record<CommunityTrigger["type"], string[]>> = {
  course_enrollment: ["course", "quiz"], // quiz is a subtype of course in lmsCourses
  webinar_registration: ["webinar"],
  download_purchase: ["download"],
  membership_subscription: ["membership"],
};

/**
 * Evaluate all active workflow rules for the given trigger and add the user
 * to any matching communities (silently — no welcome email, no XP award).
 * Also checks communities with accessType="linked" whose linkedAccessItems
 * contain the purchased product.
 */
export async function fireCommunityWorkflowRules(
  userId: number,
  trigger: CommunityTrigger,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    // ── 1. Workflow-rules-based auto-join ──────────────────────────────────────
    const matchingRules = await db
      .select()
      .from(communityWorkflowRules)
      .where(
        and(
          eq(communityWorkflowRules.triggerType, trigger.type as any),
          eq(communityWorkflowRules.isActive, true),
        ),
      );

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

    // ── 2. linkedAccessItems-based auto-join ───────────────────────────────────
    const productTypes = TRIGGER_TO_PRODUCT_TYPES[trigger.type];
    if (productTypes && "entityId" in trigger) {
      const entityId = (trigger as any).entityId as number;
      const linkedCommunities = await db
        .select({ id: communities.id, linkedAccessItems: communities.linkedAccessItems })
        .from(communities)
        .where(and(eq(communities.status, "published"), eq(communities.accessType, "linked")));

      for (const c of linkedCommunities) {
        if (!c.linkedAccessItems) continue;
        try {
          const items = JSON.parse(c.linkedAccessItems) as Array<{ type: string; id: number }>;
          const matched = items.find(i => productTypes.includes(i.type) && i.id === entityId);
          if (!matched) continue;

          await db.insert(communityMembers).values({
            communityId: c.id,
            userId,
            role: "member",
            memberStatus: "approved",
          }).onDuplicateKeyUpdate({ set: { memberStatus: "approved" } });
          console.log(
            `[CommunityAutoJoin] User ${userId} auto-joined community ${c.id} via linked ${matched.type} #${entityId}`,
          );
        } catch { /* skip malformed JSON */ }
      }
    }

    // ── 3. Course-linked communities (community_course_linkages junction) ─────
    if (trigger.type === "course_enrollment" && "entityId" in trigger) {
      const courseId = (trigger as any).entityId as number;
      const linkedRows = await db
        .select({ communityId: communityCourseLinkages.communityId })
        .from(communityCourseLinkages)
        .innerJoin(communities, eq(communities.id, communityCourseLinkages.communityId))
        .where(and(
          eq(communityCourseLinkages.lmsCourseId, courseId),
          eq(communities.status, "published"),
        ));

      for (const { communityId } of linkedRows) {
        const existing = await db
          .select({ id: communityMembers.id })
          .from(communityMembers)
          .where(and(
            eq(communityMembers.communityId, communityId),
            eq(communityMembers.userId, userId),
          ))
          .limit(1);
        if (existing.length > 0) continue;

        await db.insert(communityMembers).values({
          communityId,
          userId,
          role: "member",
          memberStatus: "approved",
        }).onDuplicateKeyUpdate({ set: { memberStatus: "approved" } });
        console.log(
          `[CommunityAutoJoin] User ${userId} auto-joined community ${communityId} via course #${courseId} linkage`,
        );
      }
    }
  } catch (err) {
    // Non-blocking — log but don't throw
    console.error("[CommunityAutoJoin] Error firing workflow rules:", err);
  }
}

/** Call after a user is enrolled in an LMS course (purchase, admin grant, free enroll, etc.). */
export function onCourseEnrollment(userId: number, courseId: number): void {
  fireCommunityWorkflowRules(userId, { type: "course_enrollment", entityId: courseId }).catch(() => {});
}
