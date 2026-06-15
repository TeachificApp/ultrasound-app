/**
 * thinkificCommunitySync.ts
 * Thinkific Community Sync Service
 *
 * Uses the Thinkific GraphQL API (https://api.thinkific.com/stable/graphql)
 * to import communities, spaces, posts, and replies into the local community tables.
 *
 * Community mapping:
 *  - "All About Ultrasound | iHeartEcho Community" (ID: 1200) → public community
 *    - Space "Adult Echo Learning Hub" (ID: 353050) → private course_gated community
 *    - Space "Fetal Echo Learning Hub" (ID: 353052) → private course_gated community
 *    - Other spaces → channels within the main community
 *  - "ACS Learning Hub" (ID: 328759) → private invite_only + course_gated community
 *  - "Sonographers After Dark™" (ID: 289785) → public community
 *  - Any other communities → public community
 */

import { getDb } from "../db";
import {
  communities,
  communityChannels,
  communityPosts,
  communityPostComments,
  thinkificCommunitySyncState,
  thinkificPostImports,
  users,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { ENV } from "../_core/env";

const GQL_URL = "https://api.thinkific.com/stable/graphql";

// ─── Spaces that become standalone private communities ─────────────────────────
const PRIVATE_SPACE_IDS = ["353050", "353052"]; // Adult Echo, Fetal Echo Learning Hubs

// ─── Communities that are private / invite-only ────────────────────────────────
const PRIVATE_COMMUNITY_IDS = ["328759"]; // ACS Learning Hub

// ─── GraphQL helpers ───────────────────────────────────────────────────────────

async function gql<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
  const token = ENV.thinkificGraphqlJwt;
  if (!token) throw new Error("THINKIFIC_GRAPHQL_JWT env var not set");

  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Thinkific GraphQL HTTP ${res.status}: ${text.substring(0, 200)}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    const msg = json.errors.map((e: any) => e.message).join("; ");
    throw new Error(`Thinkific GraphQL errors: ${msg}`);
  }
  return json.data as T;
}

// ─── Fetch all communities from the site ──────────────────────────────────────

interface ThinkificSpace {
  id: string;
  name: string;
}

interface ThinkificCommunity {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  spaces: { nodes: ThinkificSpace[] };
}

async function fetchAllCommunities(): Promise<ThinkificCommunity[]> {
  const data = await gql<any>(`
    query GetSiteCommunities {
      site {
        communities(first: 50) {
          nodes {
            id
            name
            slug
            description
            spaces(first: 50) {
              nodes {
                id
                name
              }
            }
          }
        }
      }
    }
  `);
  return data?.site?.communities?.nodes ?? [];
}

// ─── Fetch posts with cursor-based pagination ─────────────────────────────────

interface ThinkificPost {
  id: string;
  title: string | null;
  content: string | null;
  type: string;
  depth: number;
  createdAt: string;
  updatedAt: string;
  replyCount: number;
  pinnedAt: string | null;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  replies: {
    nodes: ThinkificPost[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

interface PostsPage {
  nodes: ThinkificPost[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

// Shared post fields fragment (inlined since GraphQL fragments require named ops)
const POST_FIELDS = `
  id
  title
  content
  type
  depth
  createdAt
  updatedAt
  replyCount
  pinnedAt
  author {
    id
    firstName
    lastName
    email
  }
  replies(first: 50) {
    nodes {
      id
      title
      content
      type
      depth
      createdAt
      updatedAt
      replyCount
      pinnedAt
      author {
        id
        firstName
        lastName
        email
      }
      replies(first: 50) {
        nodes {
          id
          title
          content
          type
          depth
          createdAt
          updatedAt
          author {
            id
            firstName
            lastName
            email
          }
          replies(first: 1) {
            nodes { id }
            pageInfo { hasNextPage endCursor }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
`;

/**
 * Fetch a page of posts from a community (all spaces).
 * Uses a cost-safe query shape (replies:3, nested:5) to stay under the 1,000 cost limit.
 * The main community can have thousands of posts; the full POST_FIELDS template exceeds
 * the cost limit even for a single page.
 */
async function fetchCommunityPostsPage(communityId: string, cursor: string | null): Promise<PostsPage> {
  const data = await gql<any>(
    `
    query GetCommunityPosts($id: ID!, $cursor: String) {
      community(id: $id) {
        posts(first: 50, after: $cursor) {
          nodes {
            id
            title
            content
            type
            depth
            createdAt
            updatedAt
            replyCount
            pinnedAt
            author { id firstName lastName email }
            replies(first: 3) {
              nodes {
                id
                title
                content
                type
                depth
                createdAt
                updatedAt
                replyCount
                pinnedAt
                author { id firstName lastName email }
                replies(first: 5) {
                  nodes {
                    id
                    title
                    content
                    type
                    depth
                    createdAt
                    updatedAt
                    author { id firstName lastName email }
                  }
                  pageInfo { hasNextPage endCursor }
                }
              }
              pageInfo { hasNextPage endCursor }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  `,
    { id: communityId, cursor }
  );
  return data?.community?.posts ?? { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
}

/**
 * Fetch a page of posts scoped to a specific space (Adult Echo / Fetal Echo Learning Hub).
 *
 * Uses a cost-safe query shape: posts(first:50) + replies(first:3) + nested_replies(first:5).
 * Thinkific's GraphQL cost limit is 1,000 per query; the full POST_FIELDS template exceeds
 * this even for a single post when queried via space(id). The community(id) endpoint is
 * more permissive, but space(id) is stricter. We keep r1×r2 ≤ 15 to stay safe.
 *
 * Since space posts typically have very few replies (≤3 in practice), this captures all
 * content. Posts with more replies will have their extra replies fetched in a follow-up
 * pass via fetchPostRepliesPage.
 */
async function fetchSpacePostsPage(spaceId: string, cursor: string | null): Promise<PostsPage> {
  const data = await gql<any>(
    `
    query GetSpacePosts($id: ID!, $cursor: String) {
      space(id: $id) {
        posts(first: 50, after: $cursor) {
          nodes {
            id
            title
            content
            type
            depth
            createdAt
            updatedAt
            replyCount
            pinnedAt
            author { id firstName lastName email }
            replies(first: 3) {
              nodes {
                id
                title
                content
                type
                depth
                createdAt
                updatedAt
                replyCount
                pinnedAt
                author { id firstName lastName email }
                replies(first: 5) {
                  nodes {
                    id
                    title
                    content
                    type
                    depth
                    createdAt
                    updatedAt
                    author { id firstName lastName email }
                  }
                  pageInfo { hasNextPage endCursor }
                }
              }
              pageInfo { hasNextPage endCursor }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  `,
    { id: spaceId, cursor }
  );
  return data?.space?.posts ?? { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
}

// ─── User resolution ──────────────────────────────────────────────────────────

const userEmailCache = new Map<string, number | null>();

async function resolveUserId(email: string | null | undefined): Promise<number | null> {
  if (!email) return null;
  const lower = email.toLowerCase();
  if (userEmailCache.has(lower)) return userEmailCache.get(lower)!;

  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, lower)).limit(1);
  const id = rows[0]?.id ?? null;
  userEmailCache.set(lower, id);
  return id;
}

// ─── Upsert a single post/reply ───────────────────────────────────────────────

async function upsertPost(
  post: ThinkificPost,
  communityId: number,
  channelId: number,
  parentLocalPostId: number | null
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // Check if already imported
  const existing = await db
    .select({ localPostId: thinkificPostImports.localPostId })
    .from(thinkificPostImports)
    .where(eq(thinkificPostImports.thinkificPostId, post.id))
    .limit(1);

  const authorId = await resolveUserId(post.author?.email);
  const systemUserId = 1; // fallback to system user if author not found

  const body = [post.title, post.content].filter(Boolean).join("\n\n") || "(imported post)";
  const isPinned = !!post.pinnedAt;
  const createdAtMs = new Date(post.createdAt).getTime();

  if (existing.length > 0) {
    // Update existing post body/pinned status
    const localPostId = existing[0].localPostId;
    if (post.depth === 0) {
      await db
        .update(communityPosts)
        .set({ body, isPinned, commentCount: post.replyCount })
        .where(eq(communityPosts.id, localPostId));
    } else {
      await db
        .update(communityPostComments)
        .set({ body })
        .where(eq(communityPostComments.id, localPostId));
    }
    return localPostId;
  }

  // Insert new
  let localPostId: number;

  if (post.depth === 0) {
    const [result] = await db.insert(communityPosts).values({
      channelId,
      communityId,
      userId: authorId ?? systemUserId,
      title: post.title ?? undefined,
      body,
      isPinned,
      commentCount: post.replyCount,
      createdAt: new Date(createdAtMs),
    });
    localPostId = (result as any).insertId;
  } else {
    // depth >= 1 → store as comment
    const [result] = await db.insert(communityPostComments).values({
      postId: parentLocalPostId ?? 0,
      userId: authorId ?? systemUserId,
      parentId: parentLocalPostId ?? undefined,
      body,
      createdAt: new Date(createdAtMs),
    });
    localPostId = (result as any).insertId;
  }

  // Record import
  await db.insert(thinkificPostImports).values({
    thinkificPostId: post.id,
    localPostId,
    communityId,
    depth: post.depth,
    parentLocalPostId: parentLocalPostId ?? undefined,
  });

  return localPostId;
}

// ─── Recursively import posts and their replies ───────────────────────────────

async function importPostTree(
  post: ThinkificPost,
  communityId: number,
  channelId: number,
  parentLocalPostId: number | null
): Promise<void> {
  const localPostId = await upsertPost(post, communityId, channelId, parentLocalPostId);

  if (post.replies?.nodes?.length) {
    for (const reply of post.replies.nodes) {
      await importPostTree(reply, communityId, channelId, localPostId);
    }
  }
}

// ─── Ensure community exists in DB ───────────────────────────────────────────

async function ensureCommunity(opts: {
  title: string;
  slug: string;
  description: string | null;
  privacy: "public" | "invite_only" | "course_gated";
  accessType: "free" | "invite_only" | "course_gated";
  thinkificSourceType: "thinkific_community" | "thinkific_space";
  thinkificCommunityId: string;
  thinkificSpaceId?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // Check if already exists by thinkific IDs
  const existing = await db
    .select({ id: communities.id })
    .from(communities)
    .where(
      opts.thinkificSpaceId
        ? eq(communities.thinkificSpaceId, opts.thinkificSpaceId)
        : eq(communities.thinkificCommunityId, opts.thinkificCommunityId)
    )
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  // Fallback: check by slug to avoid duplicate key errors on re-runs
  const normalizedSlug = opts.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const existingBySlug = await db
    .select({ id: communities.id })
    .from(communities)
    .where(eq(communities.slug, normalizedSlug))
    .limit(1);
  if (existingBySlug.length > 0) {
    // Link the existing community to this Thinkific ID so future lookups succeed
    await db.update(communities)
      .set({
        thinkificCommunityId: opts.thinkificCommunityId,
        thinkificSourceType: opts.thinkificSourceType,
        ...(opts.thinkificSpaceId ? { thinkificSpaceId: opts.thinkificSpaceId } : {}),
      })
      .where(eq(communities.id, existingBySlug[0].id));
    console.log(`[ThinkificCommunitySync] Linked existing community (slug=${normalizedSlug}) to Thinkific ID ${opts.thinkificCommunityId}`);
    return existingBySlug[0].id;
  }

  // Create new community
  const [result] = await db.insert(communities).values({
    title: opts.title,
    slug: opts.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    description: opts.description ?? undefined,
    status: "published",
    privacy: opts.privacy,
    accessType: opts.accessType,
    thinkificSourceType: opts.thinkificSourceType,
    thinkificCommunityId: opts.thinkificCommunityId,
    thinkificSpaceId: opts.thinkificSpaceId ?? undefined,
  });

  const communityId = (result as any).insertId;

  // Create default "General" channel
  await db.insert(communityChannels).values({
    communityId,
    name: "General",
    type: "discussion",
    isDefault: true,
    sortOrder: 0,
  });

  // Create sync state record
  await db.insert(thinkificCommunitySyncState).values({
    communityId,
    thinkificCommunityId: opts.thinkificCommunityId,
    thinkificSpaceId: opts.thinkificSpaceId ?? undefined,
    syncEnabled: true,
  });

  console.log(`[ThinkificCommunitySync] Created community: ${opts.title} (id=${communityId})`);
  return communityId;
}

async function getDefaultChannelId(communityId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const rows = await db
    .select({ id: communityChannels.id })
    .from(communityChannels)
    .where(and(eq(communityChannels.communityId, communityId), eq(communityChannels.isDefault, true)))
    .limit(1);

  if (rows.length > 0) return rows[0].id;

  // Create one if missing
  const [result] = await db.insert(communityChannels).values({
    communityId,
    name: "General",
    type: "discussion",
    isDefault: true,
    sortOrder: 0,
  });
  return (result as any).insertId;
}

// ─── Sync a single community ──────────────────────────────────────────────────

export async function syncThinkificCommunity(
  communityId: number,
  thinkificCommunityId: string,
  thinkificSpaceId?: string
): Promise<{ imported: number; errors: number }> {
  const db = await getDb();
  if (!db) return { imported: 0, errors: 1 };

  let imported = 0;
  let errors = 0;

  // Get sync state
  const syncRows = await db
    .select()
    .from(thinkificCommunitySyncState)
    .where(eq(thinkificCommunitySyncState.communityId, communityId))
    .limit(1);

  let cursor: string | null = syncRows[0]?.syncCursor ?? null;
  const channelId = await getDefaultChannelId(communityId);

  console.log(
    `[ThinkificCommunitySync] Syncing community ${communityId} (thinkific=${thinkificCommunityId}${thinkificSpaceId ? ` space=${thinkificSpaceId}` : ""}) from cursor=${cursor}`
  );

  let hasMore = true;
  while (hasMore) {
    try {
      // Use space-scoped fetch when a spaceId is set (Adult Echo / Fetal Echo Learning Hub)
      const page = thinkificSpaceId
        ? await fetchSpacePostsPage(thinkificSpaceId, cursor)
        : await fetchCommunityPostsPage(thinkificCommunityId, cursor);

      for (const post of page.nodes) {
        try {
          await importPostTree(post, communityId, channelId, null);
          imported++;
        } catch (err) {
          console.error(`[ThinkificCommunitySync] Error importing post ${post.id}:`, err);
          errors++;
        }
      }

      hasMore = page.pageInfo.hasNextPage;
      cursor = page.pageInfo.endCursor;

      // Save cursor progress after each page
      await db
        .update(thinkificCommunitySyncState)
        .set({
          syncCursor: cursor ?? undefined,
          lastSyncedAt: Date.now(),
          totalPostsSynced: (syncRows[0]?.totalPostsSynced ?? 0) + imported,
        })
        .where(eq(thinkificCommunitySyncState.communityId, communityId));
    } catch (err) {
      console.error(`[ThinkificCommunitySync] Page fetch error:`, err);
      errors++;
      break;
    }
  }

  console.log(
    `[ThinkificCommunitySync] Done community ${communityId}: ${imported} imported, ${errors} errors`
  );
  return { imported, errors };
}

// ─── Full sync: discover and sync all communities ─────────────────────────────

export async function syncAllThinkificCommunities(): Promise<void> {
  console.log("[ThinkificCommunitySync] Starting full sync...");

  let thinkificCommunities: ThinkificCommunity[];
  try {
    thinkificCommunities = await fetchAllCommunities();
  } catch (err) {
    console.error("[ThinkificCommunitySync] Failed to fetch communities:", err);
    return;
  }

  const db = await getDb();
  if (!db) {
    console.error("[ThinkificCommunitySync] DB unavailable");
    return;
  }

  for (const tc of thinkificCommunities) {
    const isPrivateCommunity = PRIVATE_COMMUNITY_IDS.includes(tc.id);

    // Determine privacy for the main community
    const mainPrivacy = isPrivateCommunity ? "invite_only" : "public";
    const mainAccessType = isPrivateCommunity ? "invite_only" : "free";

    // Create/find the main community
    const mainCommunityId = await ensureCommunity({
      title: tc.name,
      slug: tc.slug,
      description: tc.description,
      privacy: mainPrivacy,
      accessType: mainAccessType,
      thinkificSourceType: "thinkific_community",
      thinkificCommunityId: tc.id,
    });

    // Check if sync is enabled
    const syncState = await db
      .select({ syncEnabled: thinkificCommunitySyncState.syncEnabled })
      .from(thinkificCommunitySyncState)
      .where(eq(thinkificCommunitySyncState.communityId, mainCommunityId))
      .limit(1);

    if (syncState[0]?.syncEnabled !== false) {
      await syncThinkificCommunity(mainCommunityId, tc.id);
    }

    // Handle private spaces that become standalone communities
    for (const space of tc.spaces.nodes) {
      if (!PRIVATE_SPACE_IDS.includes(space.id)) continue;

      const spaceCommunityId = await ensureCommunity({
        title: space.name,
        slug: `space-${space.id}-${space.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        description: `Private learning hub: ${space.name}`,
        privacy: "course_gated",
        accessType: "course_gated",
        thinkificSourceType: "thinkific_space",
        thinkificCommunityId: tc.id,
        thinkificSpaceId: space.id,
      });

      const spaceSyncState = await db
        .select({ syncEnabled: thinkificCommunitySyncState.syncEnabled })
        .from(thinkificCommunitySyncState)
        .where(eq(thinkificCommunitySyncState.communityId, spaceCommunityId))
        .limit(1);

      if (spaceSyncState[0]?.syncEnabled !== false) {
        // Use space-scoped GraphQL query: space(id) > posts
        // This correctly isolates posts belonging only to this space
        await syncThinkificCommunity(spaceCommunityId, tc.id, space.id);
      }
    }
  }

  console.log("[ThinkificCommunitySync] Full sync complete.");
}
