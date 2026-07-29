import { eq, and, asc, desc, sql, isNull, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { questionBankFolders, questionBankItems } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
function getDb() {
  if (!_db) _db = drizzle(process.env.DATABASE_URL as string);
  return _db;
}
const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_t, prop) { return (getDb() as any)[prop]; },
});

// ─── Folders ──────────────────────────────────────────────────────────────────
export async function getFoldersByOrg(orgId: number) {
  return db.select().from(questionBankFolders)
    .where(eq(questionBankFolders.orgId, orgId))
    .orderBy(asc(questionBankFolders.sortOrder), asc(questionBankFolders.name));
}

export async function getFolderById(id: number) {
  const [f] = await db.select().from(questionBankFolders).where(eq(questionBankFolders.id, id));
  return f ?? null;
}

export async function createFolder(data: typeof questionBankFolders.$inferInsert) {
  const [result] = await db.insert(questionBankFolders).values(data as any);
  return { id: (result as any).insertId };
}

export async function updateFolder(id: number, data: Partial<typeof questionBankFolders.$inferInsert>) {
  await db.update(questionBankFolders).set(data as any).where(eq(questionBankFolders.id, id));
}

export async function deleteFolder(id: number) {
  // Move all items in this folder to unfiled
  await db.update(questionBankItems).set({ folderId: null } as any).where(eq(questionBankItems.folderId, id));
  // Move child folders to root
  await db.update(questionBankFolders).set({ parentId: null } as any).where(eq(questionBankFolders.parentId, id));
  await db.delete(questionBankFolders).where(eq(questionBankFolders.id, id));
}

// ─── Questions ────────────────────────────────────────────────────────────────
export async function getQuestionsByOrg(orgId: number, opts: {
  folderId?: number | null;
  questionType?: string;
  difficulty?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const conditions: any[] = [eq(questionBankItems.orgId, orgId)];
  if (opts.folderId !== undefined) {
    if (opts.folderId === null) {
      conditions.push(isNull(questionBankItems.folderId));
    } else {
      conditions.push(eq(questionBankItems.folderId, opts.folderId));
    }
  }
  if (opts.questionType) {
    conditions.push(eq(questionBankItems.questionType, opts.questionType as any));
  }
  if (opts.difficulty) {
    conditions.push(eq(questionBankItems.difficulty, opts.difficulty as any));
  }
  if (opts.search) {
    conditions.push(sql`${questionBankItems.stem} LIKE ${'%' + opts.search + '%'}`);
  }
  const query = db.select().from(questionBankItems)
    .where(and(...conditions))
    .orderBy(desc(questionBankItems.updatedAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
  return query;
}

export async function getQuestionCountByOrg(orgId: number, folderId?: number | null) {
  const conditions: any[] = [eq(questionBankItems.orgId, orgId)];
  if (folderId !== undefined) {
    if (folderId === null) {
      conditions.push(isNull(questionBankItems.folderId));
    } else {
      conditions.push(eq(questionBankItems.folderId, folderId));
    }
  }
  const [row] = await db.select({ count: sql<number>`count(*)` })
    .from(questionBankItems)
    .where(and(...conditions));
  return Number(row?.count ?? 0);
}

export async function getQuestionById(id: number) {
  const [q] = await db.select().from(questionBankItems).where(eq(questionBankItems.id, id));
  return q ?? null;
}

export async function getQuestionsByIds(orgId: number, ids: number[]) {
  if (ids.length === 0) return [];
  return db.select().from(questionBankItems)
    .where(and(eq(questionBankItems.orgId, orgId), inArray(questionBankItems.id, ids)))
    .orderBy(desc(questionBankItems.updatedAt));
}

export async function createQuestion(data: typeof questionBankItems.$inferInsert) {
  const [result] = await db.insert(questionBankItems).values(data as any);
  return { id: (result as any).insertId };
}

export async function updateQuestion(id: number, data: Partial<typeof questionBankItems.$inferInsert>) {
  await db.update(questionBankItems).set(data as any).where(eq(questionBankItems.id, id));
}

export async function deleteQuestion(id: number) {
  await db.delete(questionBankItems).where(eq(questionBankItems.id, id));
}

export async function bulkDeleteQuestions(orgId: number, ids: number[]) {
  if (ids.length === 0) return;
  await db.delete(questionBankItems)
    .where(and(eq(questionBankItems.orgId, orgId), inArray(questionBankItems.id, ids)));
}

export async function moveQuestionsToFolder(orgId: number, ids: number[], folderId: number | null) {
  if (ids.length === 0) return;
  await db.update(questionBankItems)
    .set({ folderId } as any)
    .where(and(eq(questionBankItems.orgId, orgId), inArray(questionBankItems.id, ids)));
}

export async function copyQuestionsToFolder(orgId: number, ids: number[], folderId: number | null, createdBy: number) {
  const sourceQuestions = await getQuestionsByIds(orgId, ids);
  let copied = 0;
  for (const q of sourceQuestions) {
    await createQuestion({
      orgId,
      folderId,
      questionType: q.questionType,
      stem: `${q.stem} (copy)`,
      dataJson: q.dataJson,
      points: q.points,
      difficulty: q.difficulty,
      tags: q.tags,
      explanation: q.explanation,
      createdBy,
    } as typeof questionBankItems.$inferInsert);
    copied++;
  }
  return copied;
}

export async function incrementUsageCount(ids: number[]) {
  if (ids.length === 0) return;
  await db.update(questionBankItems)
    .set({ usageCount: sql`usageCount + 1` } as any)
    .where(sql`${questionBankItems.id} IN (${sql.raw(ids.join(","))})`);
}
