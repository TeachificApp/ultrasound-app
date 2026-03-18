import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  cases,
  challengeResponses,
  dailyChallenges,
  flashcards,
  soundbytes,
  thinkificWebhookEvents,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===== FLASHCARDS =====
export async function getFlashcards() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(flashcards).where(eq(flashcards.isActive, true)).orderBy(flashcards.id);
}

export async function getFlashcardsByCategory(category: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(flashcards)
    .where(and(eq(flashcards.isActive, true), eq(flashcards.category, category as any)))
    .orderBy(flashcards.id);
}

export async function getUserFlashcardCount(userId: number) {
  const db = await getDb();
  if (!db) return { count: 0, date: "" };
  const result = await db.select({ flashcardsToday: users.flashcardsToday, flashcardsDate: users.flashcardsDate })
    .from(users).where(eq(users.id, userId)).limit(1);
  return result[0] ?? { flashcardsToday: 0, flashcardsDate: "" };
}

export async function updateUserFlashcardCount(userId: number, count: number, date: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ flashcardsToday: count, flashcardsDate: date }).where(eq(users.id, userId));
}

export async function createFlashcard(data: { question: string; answer: string; category: string; difficulty?: "basic" | "intermediate" | "advanced" }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(flashcards).values({ ...data, category: data.category as any, difficulty: data.difficulty ?? "basic" });
  return { success: true };
}

export async function updateFlashcard(data: { id: number; question?: string; answer?: string; category?: string; difficulty?: "basic" | "intermediate" | "advanced"; isActive?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { id, ...rest } = data;
  await db.update(flashcards).set(rest as any).where(eq(flashcards.id, id));
  return { success: true };
}

export async function deleteFlashcard(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(flashcards).set({ isActive: false }).where(eq(flashcards.id, id));
  return { success: true };
}

// ===== CASES =====
export async function getCases(filter?: { category?: string; caseType?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(cases.isPublished, true)];
  if (filter?.category && filter.category !== "all") {
    conditions.push(eq(cases.category, filter.category as any));
  }
  if (filter?.caseType && filter.caseType !== "all") {
    conditions.push(eq(cases.caseType, filter.caseType as any));
  }
  return db.select().from(cases).where(and(...conditions)).orderBy(desc(cases.createdAt));
}

export async function getCaseById(id: number) {
  const db = await getDb();
  if (!db) return null;
  // Increment view count
  await db.update(cases).set({ viewCount: sql`${cases.viewCount} + 1` }).where(eq(cases.id, id));
  const result = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
  return result[0] ?? null;
}

export async function submitCase(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(cases).values({ ...data, isPublished: false });
  return { success: true };
}

export async function createCase(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(cases).values({ ...data, isPublished: false });
  return { success: true };
}

export async function updateCase(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { id, ...rest } = data;
  await db.update(cases).set(rest).where(eq(cases.id, id));
  return { success: true };
}

export async function publishCase(id: number, isPublished: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Set display view count to a realistic number when first published
  const displayCount = isPublished ? Math.floor(Math.random() * 200) + 50 : 0;
  await db.update(cases).set({ isPublished, displayViewCount: displayCount }).where(eq(cases.id, id));
  return { success: true };
}

export async function deleteCase(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(cases).where(eq(cases.id, id));
  return { success: true };
}

// ===== SOUNDBYTES =====
export async function getSoundBytes(category?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(soundbytes.isActive, true)];
  if (category && category !== "all") {
    conditions.push(eq(soundbytes.category, category as any));
  }
  return db.select().from(soundbytes).where(and(...conditions)).orderBy(soundbytes.sortOrder, desc(soundbytes.createdAt));
}

export async function createSoundByte(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(soundbytes).values(data);
  return { success: true };
}

export async function updateSoundByte(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { id, ...rest } = data;
  await db.update(soundbytes).set(rest).where(eq(soundbytes.id, id));
  return { success: true };
}

export async function deleteSoundByte(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(soundbytes).set({ isActive: false }).where(eq(soundbytes.id, id));
  return { success: true };
}

// ===== DAILY CHALLENGE =====
export async function getTodayChallenge() {
  const db = await getDb();
  if (!db) return null;
  const today = new Date().toISOString().split("T")[0];
  const result = await db.select().from(dailyChallenges)
    .where(and(eq(dailyChallenges.challengeDate, today), eq(dailyChallenges.isActive, true)))
    .limit(1);
  return result[0] ?? null;
}

export async function getUserChallengeResponse(userId: number, date: string) {
  const db = await getDb();
  if (!db) return null;
  const challenge = await db.select().from(dailyChallenges)
    .where(eq(dailyChallenges.challengeDate, date)).limit(1);
  if (!challenge[0]) return null;
  const response = await db.select().from(challengeResponses)
    .where(and(eq(challengeResponses.userId, userId), eq(challengeResponses.challengeId, challenge[0].id)))
    .limit(1);
  return response[0] ?? null;
}

export async function submitChallengeAnswer(userId: number, challengeId: number, selectedAnswer: "A" | "B" | "C" | "D") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const challenge = await db.select().from(dailyChallenges).where(eq(dailyChallenges.id, challengeId)).limit(1);
  if (!challenge[0]) throw new Error("Challenge not found");
  const isCorrect = challenge[0].correctAnswer === selectedAnswer;
  const pointsEarned = isCorrect ? 10 : 2;
  await db.insert(challengeResponses).values({ userId, challengeId, selectedAnswer, isCorrect, pointsEarned });
  // Update user points and streak
  const today = new Date().toISOString().split("T")[0];
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (user[0]) {
    const newPoints = (user[0].totalPoints ?? 0) + pointsEarned;
    const lastDate = user[0].lastChallengeDate;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const newStreak = lastDate === yesterday ? (user[0].streakCount ?? 0) + 1 : 1;
    await db.update(users).set({ totalPoints: newPoints, streakCount: newStreak, lastChallengeDate: today }).where(eq(users.id, userId));
  }
  return { isCorrect, pointsEarned, correctAnswer: challenge[0].correctAnswer, explanation: challenge[0].explanation };
}

export async function createDailyChallenge(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(dailyChallenges).values(data);
  return { success: true };
}

export async function updateDailyChallenge(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { id, ...rest } = data;
  await db.update(dailyChallenges).set(rest).where(eq(dailyChallenges.id, id));
  return { success: true };
}

// ===== LEADERBOARD =====
export async function getLeaderboard() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    name: users.name,
    totalPoints: users.totalPoints,
    streakCount: users.streakCount,
  }).from(users).orderBy(desc(users.totalPoints)).limit(50);
}

// ===== USER PROFILE =====
export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0] ?? null;
}

// ===== THINKIFIC WEBHOOK =====
export async function logThinkificEvent(eventType: string, payload: any) {
  const db = await getDb();
  if (!db) return;
  const userEmail = payload?.user?.email ?? payload?.email ?? null;
  const thinkificUserId = payload?.user?.id?.toString() ?? payload?.id?.toString() ?? null;
  await db.insert(thinkificWebhookEvents).values({ eventType, thinkificUserId, userEmail, payload });
}

export async function updateMembershipFromThinkific(eventType: string, payload: any) {
  const db = await getDb();
  if (!db) return;
  const email = payload?.user?.email ?? payload?.email;
  if (!email) return;

  // Determine membership tier based on event type and bundle
  let tier: "free" | "premium" | null = null;
  const bundleId = payload?.bundle_id ?? payload?.product_id ?? "";
  const bundleName = (payload?.bundle_name ?? payload?.product_name ?? "").toLowerCase();

  if (eventType === "enrollment.created" || eventType === "enrollment.updated") {
    if (bundleName.includes("premium") || bundleId === "3714929") {
      tier = "premium";
    } else if (bundleName.includes("free") || bundleId === "3714918") {
      tier = "free";
    }
  } else if (eventType === "enrollment.expired" || eventType === "enrollment.cancelled") {
    if (bundleName.includes("premium") || bundleId === "3714929") {
      tier = "free"; // Downgrade on cancellation
    }
  }

  if (tier) {
    await db.update(users).set({ membershipTier: tier }).where(eq(users.email, email));
  }
}

// ===== ADMIN =====
export async function getAdminStats() {
  const db = await getDb();
  if (!db) return { users: 0, flashcards: 0, cases: 0, soundbytes: 0 };
  const [userCount, flashcardCount, caseCount, soundbyteCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users),
    db.select({ count: sql<number>`count(*)` }).from(flashcards).where(eq(flashcards.isActive, true)),
    db.select({ count: sql<number>`count(*)` }).from(cases).where(eq(cases.isPublished, true)),
    db.select({ count: sql<number>`count(*)` }).from(soundbytes).where(eq(soundbytes.isActive, true)),
  ]);
  return {
    users: Number(userCount[0]?.count ?? 0),
    flashcards: Number(flashcardCount[0]?.count ?? 0),
    cases: Number(caseCount[0]?.count ?? 0),
    soundbytes: Number(soundbyteCount[0]?.count ?? 0),
  };
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}
