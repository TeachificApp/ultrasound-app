import { and, eq } from "drizzle-orm";
import { communities, communityChannels, communityMembers } from "../../drizzle/schema";

type Db = any;
type ExpoEvent = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  heroImageUrl?: string | null;
};

function communitySlug(event: ExpoEvent) {
  return `ultrasoundexpo-${event.slug}`.slice(0, 255);
}

/**
 * Creates one private Community surface for an Expo event instance. The normal
 * community feed, discussions, documents, reactions, and direct messages are
 * then reused without exposing that instance to non-registrants.
 */
export async function ensureUltrasoundExpoEventCommunity(db: Db, event: ExpoEvent) {
  const slug = communitySlug(event);
  let [community] = await db.select().from(communities).where(eq(communities.slug, slug)).limit(1);
  if (!community) {
    const created = await db.insert(communities).values({
      title: `${event.name} Community`,
      slug,
      brand: "all_about_ultrasound",
      description: event.description || `Private community for registered ${event.name} attendees, exhibitors, and sponsors.`,
      coverImage: event.heroImageUrl || null,
      logoImage: null,
      status: "published",
      privacy: "private",
      accessType: "restricted",
      accentColor: "#087f8c",
      welcomeMessage: "Connect with fellow attendees, exhibitors, sponsors, and the UltrasoundExpo™ team.",
      headerStyle: "banner",
      layoutStyle: "sidebar",
    }).$returningId();
    const id = created[0]?.id;
    if (!id) throw new Error("Unable to create an UltrasoundExpo™ event community.");
    [community] = await db.select().from(communities).where(eq(communities.id, id)).limit(1);
    if (!community) throw new Error("Unable to load the UltrasoundExpo™ event community.");
    await db.insert(communityChannels).values([
      { communityId: id, name: "Announcements", description: "Official UltrasoundExpo™ event updates.", type: "announcements", sortOrder: 0, isDefault: true },
      { communityId: id, name: "Event conversations", description: "Meet peers and discuss the event.", type: "discussion", sortOrder: 1, isDefault: false },
      { communityId: id, name: "Resources", description: "Event materials and participant resources.", type: "resources", sortOrder: 2, isDefault: false },
    ]);
  }
  return community;
}

/** Grants an eligible account access without making the event community publicly joinable. */
export async function grantUltrasoundExpoEventCommunityAccess(
  db: Db,
  event: ExpoEvent,
  userId: number,
  role: "admin" | "member" = "member",
) {
  const community = await ensureUltrasoundExpoEventCommunity(db, event);
  const [member] = await db.select().from(communityMembers)
    .where(and(eq(communityMembers.communityId, community.id), eq(communityMembers.userId, userId)))
    .limit(1);
  if (member) {
    await db.update(communityMembers).set({
      role: role === "admin" ? "admin" : member.role,
      memberStatus: "approved",
      approvedToPost: true,
    }).where(eq(communityMembers.id, member.id));
  } else {
    await db.insert(communityMembers).values({
      communityId: community.id,
      userId,
      role,
      memberStatus: "approved",
      approvedToPost: true,
    });
  }
  return community;
}
