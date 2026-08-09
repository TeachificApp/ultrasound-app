import { eq, and, inArray, or, sql } from "drizzle-orm";
import { quickfireQuestions, quickfireDailySets, quickfireChallenges } from "../../drizzle/schema";
import { getBrandCategoryConfig, CROSS_BRAND_CATEGORIES, type QuickfireBrand } from "../../shared/quickfireCategories";
import { notifyOwner } from "../_core/notification";

function sampleN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/**
 * Ensure a daily set exists for the given date and brand.
 * Backfills empty categories from the question bank when no queued challenge exists.
 */
export async function ensureTodaySet(
  db: NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>,
  date: string,
  brand: QuickfireBrand = "aaus",
  /** If provided, only backfill these specific categories (used when some categories already have queued challenges) */
  categoriesToFill?: string[],
) {
  const existing = await db
    .select()
    .from(quickfireDailySets)
    .where(and(eq(quickfireDailySets.setDate, date), eq(quickfireDailySets.brand, brand)))
    .limit(1);
  // If a full daily set already exists AND we're not doing a partial fill, skip
  if (existing.length > 0 && !categoriesToFill) return existing[0];

  const { categories: allCategories, catKey, defaultMap, questionPoolLabels } = getBrandCategoryConfig(brand);
  // Only process the requested categories (or all if not specified)
  const categories = categoriesToFill
    ? allCategories.filter(c => categoriesToFill.includes(c))
    : allCategories;
  const questionMap: Record<string, number | null> = { ...defaultMap };

  // Mark categories already covered by today's live OR archived challenges
  const todaysChallenges = await db
    .select()
    .from(quickfireChallenges)
    .where(
      and(
        inArray(quickfireChallenges.status, ["live", "archived"] as never[]),
        eq(quickfireChallenges.brand, brand),
        eq(quickfireChallenges.publishDate, date),
      )
    );

  for (const liveC of todaysChallenges) {
    if (!liveC.category) continue;
    const key = catKey[liveC.category];
    if (!key) continue;
    const ids: number[] = JSON.parse(liveC.questionIds || "[]");
    if (ids.length > 0 && questionMap[key] === null) {
      questionMap[key] = ids[0];
    }
  }

  const queuedChallenges = await db
    .select()
    .from(quickfireChallenges)
    .where(
      and(
        inArray(quickfireChallenges.status, ["draft", "scheduled"] as never[]),
        eq(quickfireChallenges.brand, brand),
      ),
    )
    .orderBy(quickfireChallenges.priority, quickfireChallenges.createdAt)
    .limit(50);

  const usedChallengeIds: number[] = [];
  const firstCat = categories[0];

  for (const cat of categories) {
    const key = catKey[cat];
    if (questionMap[key] !== null) continue;
    const match = queuedChallenges.find(
      (c) =>
        !usedChallengeIds.includes(c.id) &&
        (c.category === cat || (!c.category && cat === firstCat)) &&
        (!c.publishDate || c.publishDate <= date),
    );
    if (match) {
      const ids: number[] = JSON.parse(match.questionIds || "[]");
      if (ids.length > 0) {
        questionMap[key] = ids[0];
        usedChallengeIds.push(match.id);
        await db
          .update(quickfireChallenges)
          .set({
            status: "live",
            publishDate: match.publishDate ?? date,
            publishedAt: new Date(),
            archivedAt: null,
          })
          .where(eq(quickfireChallenges.id, match.id));
      }
    }
  }

  const categoriesPublishedToday = queuedChallenges
    .filter((c) => usedChallengeIds.includes(c.id))
    .map((c) => c.category)
    .filter(Boolean) as string[];

  if (categoriesPublishedToday.length > 0) {
    const liveRows = await db
      .select({ id: quickfireChallenges.id, category: quickfireChallenges.category })
      .from(quickfireChallenges)
      .where(and(eq(quickfireChallenges.status, "live"), eq(quickfireChallenges.brand, brand)));
    for (const row of liveRows) {
      if (
        !usedChallengeIds.includes(row.id) &&
        row.category &&
        categoriesPublishedToday.includes(row.category)
      ) {
        await db
          .update(quickfireChallenges)
          .set({ status: "archived", archivedAt: new Date() })
          .where(eq(quickfireChallenges.id, row.id));
      }
    }
  }

  const recentCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const recentArchived = await db
    .select({ category: quickfireChallenges.category, questionIds: quickfireChallenges.questionIds })
    .from(quickfireChallenges)
    .where(
      and(
        inArray(quickfireChallenges.status, ["archived", "live"] as never[]),
        eq(quickfireChallenges.brand, brand),
        sql`${quickfireChallenges.publishedAt} >= ${recentCutoff}` as never,
      ),
    );

  const usedIdsByCategory: Record<string, Set<number>> = {};
  for (const row of recentArchived) {
    const catLabel = row.category ?? "";
    if (!usedIdsByCategory[catLabel]) usedIdsByCategory[catLabel] = new Set();
    try {
      const ids: number[] = JSON.parse(row.questionIds || "[]");
      for (const id of ids) usedIdsByCategory[catLabel].add(id);
    } catch {
      /* ignore */
    }
  }

  const fallbackLiveNeeded: { cat: string; questionId: number }[] = [];

  // ── Step 2.5: Recycle oldest archived challenge for categories still empty ──
  // Before falling back to raw question bank, try to reuse archived challenges
  // (cycles through them oldest-first so questions rotate rather than repeat immediately)
  for (const cat of categories) {
    const key = catKey[cat];
    if (questionMap[key] !== null) continue;
    const [oldestArchived] = await db
      .select()
      .from(quickfireChallenges)
      .where(
        and(
          eq(quickfireChallenges.status, "archived"),
          eq(quickfireChallenges.category, cat as never),
          eq(quickfireChallenges.brand, brand),
        )
      )
      .orderBy(quickfireChallenges.publishedAt, quickfireChallenges.createdAt)
      .limit(1);
    if (oldestArchived) {
      const ids: number[] = JSON.parse(oldestArchived.questionIds || "[]");
      if (ids.length > 0) {
        questionMap[key] = ids[0];
        fallbackLiveNeeded.push({ cat, questionId: ids[0] });
        console.log(`[ensureTodaySet][${brand}] Recycling archived challenge #${oldestArchived.id} for category "${cat}"`);
      }
    }
  }

  // Brand filter: always include cross-brand categories (Fetal Echo, Physics) regardless of which brand created them
  const brandFilter = or(
    eq(quickfireQuestions.brand, brand),
    inArray(quickfireQuestions.category, CROSS_BRAND_CATEGORIES as string[]),
  )!;

  for (const cat of categories) {
    const key = catKey[cat];
    if (questionMap[key] !== null) continue;
    const usedIds = Array.from(usedIdsByCategory[cat] ?? new Set<number>());
    const poolLabels = questionPoolLabels[cat];
    const catFilter = poolLabels
      ? (sql`${quickfireQuestions.category} IN (${sql.join(poolLabels.map((c) => sql`${c}`), sql`, `)})` as never)
      : (sql`${quickfireQuestions.category} = ${cat}` as never);

    const scenarioPool = await db
      .select({ id: quickfireQuestions.id })
      .from(quickfireQuestions)
      .where(
        and(
          eq(quickfireQuestions.isActive, true),
          brandFilter,
          sql`${quickfireQuestions.type} != 'quickReview'` as never,
          catFilter,
          ...(usedIds.length > 0
            ? [sql`${quickfireQuestions.id} NOT IN (${sql.join(usedIds.map((id) => sql`${id}`), sql`, `)})` as never]
            : []),
        ),
      );

    const scenarioFull =
      scenarioPool.length > 0
        ? scenarioPool
        : await db
            .select({ id: quickfireQuestions.id })
            .from(quickfireQuestions)
            .where(
              and(
                eq(quickfireQuestions.isActive, true),
                brandFilter,
                sql`${quickfireQuestions.type} != 'quickReview'` as never,
                catFilter,
              ),
            );

    if (scenarioFull.length > 0) {
      const picked = sampleN(scenarioFull, 1)[0].id;
      questionMap[key] = picked;
      fallbackLiveNeeded.push({ cat, questionId: picked });
      continue;
    }

    const reviewPool = await db
      .select({ id: quickfireQuestions.id })
      .from(quickfireQuestions)
      .where(
        and(
          eq(quickfireQuestions.isActive, true),
          brandFilter,
          catFilter,
          ...(usedIds.length > 0
            ? [sql`${quickfireQuestions.id} NOT IN (${sql.join(usedIds.map((id) => sql`${id}`), sql`, `)})` as never]
            : []),
        ),
      );

    const reviewFull =
      reviewPool.length > 0
        ? reviewPool
        : await db
            .select({ id: quickfireQuestions.id })
            .from(quickfireQuestions)
            .where(and(eq(quickfireQuestions.isActive, true), brandFilter, catFilter));

    if (reviewFull.length > 0) {
      const picked = sampleN(reviewFull, 1)[0].id;
      questionMap[key] = picked;
      fallbackLiveNeeded.push({ cat, questionId: picked });
    }
  }

  const emptyCats = categories.filter((cat) => questionMap[catKey[cat]] === null);
  if (emptyCats.length > 0) {
    notifyOwner({
      title: `⚠️ Daily Challenge [${brand}]: ${emptyCats.length} categor${emptyCats.length === 1 ? "y has" : "ies have"} no available questions`,
      content: `The following categories had no active questions available for today's (${date}) daily challenge:\n\n${emptyCats.map((c) => `• ${c}`).join("\n")}\n\nPlease add active questions for these categories in the admin panel.`,
    }).catch(() => {});
  }

  for (const { cat, questionId } of fallbackLiveNeeded) {
    await db
      .update(quickfireChallenges)
      .set({ status: "archived", archivedAt: new Date() })
      .where(
        and(
          eq(quickfireChallenges.status, "live" as never),
          eq(quickfireChallenges.category, cat as never),
          eq(quickfireChallenges.brand, brand),
        ),
      );
    await db.insert(quickfireChallenges).values({
      title: `${cat} Daily Challenge — ${date}`,
      description: "",
      category: cat as never,
      questionIds: JSON.stringify([questionId]),
      status: "live" as never,
      priority: 100,
      brand,
      publishDate: date,
      publishedAt: new Date(),
    });
  }

  const questionIds = JSON.stringify(questionMap);
  // Use upsert so partial backfills (categoriesToFill) can update an existing daily set record
  await db
    .insert(quickfireDailySets)
    .values({ setDate: date, brand, questionIds })
    .onDuplicateKeyUpdate({ set: { questionIds } });
  return { setDate: date, questionIds };
}

export function parseDailySetIds(raw: string, brand = "aaus"): Record<string, number | null> {
  const { defaultMap } = getBrandCategoryConfig(brand);
  const defaults: Record<string, number | null> = { ...defaultMap };
  try {
    const parsed = JSON.parse(raw || "{}");
    if (Array.isArray(parsed)) {
      const firstKey = Object.keys(defaults)[0];
      return { ...defaults, [firstKey]: parsed[0] ?? null };
    }
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}
