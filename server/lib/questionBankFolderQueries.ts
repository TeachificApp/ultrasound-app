import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { questionBank, questionBankFolders, questionBankTagMap } from "../../drizzle/schema";
import type { getDb } from "../db";
import { collectDescendantFolderIds } from "../../shared/questionBankFolders";
import { ensureQuestionBankFoldersSchema } from "./ensureQuestionBankFoldersSchema";
import { extractExecuteRows } from "./ensureLmsCoursesSchema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type QuestionBankFolderRow = typeof questionBankFolders.$inferSelect;

async function listTableColumns(db: Db, tableName: string): Promise<Set<string>> {
  const result = await db.execute(
    sql`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${tableName}`,
  );
  const list = extractExecuteRows<{ COLUMN_NAME?: string; column_name?: string }>(result);
  const names = new Set<string>();
  for (const row of list) {
    const name = row.COLUMN_NAME ?? row.column_name;
    if (name) names.add(name);
  }
  return names;
}

/** Try to add sort_order; always detect whether folder queries can use it. Never throws. */
export async function prepareQuestionBankFolders(db: Db): Promise<{ hasSortOrder: boolean }> {
  await ensureQuestionBankFoldersSchema(db);
  const columns = await listTableColumns(db, "question_bank_folders");
  return { hasSortOrder: columns.has("sort_order") };
}

const legacyFolderSelect = {
  id: questionBankFolders.id,
  name: questionBankFolders.name,
  description: questionBankFolders.description,
  parentId: questionBankFolders.parentId,
  color: questionBankFolders.color,
  sortOrder: sql<number>`0`.as("sort_order"),
  sharedInSonoQuiz: questionBankFolders.sharedInSonoQuiz,
  createdByAdminId: questionBankFolders.createdByAdminId,
  createdAt: questionBankFolders.createdAt,
  updatedAt: questionBankFolders.updatedAt,
};

export async function selectQuestionBankFolders(
  db: Db,
  opts?: { sharedInSonoQuizOnly?: boolean },
): Promise<QuestionBankFolderRow[]> {
  const { hasSortOrder } = await prepareQuestionBankFolders(db);
  const where = opts?.sharedInSonoQuizOnly
    ? eq(questionBankFolders.sharedInSonoQuiz, true)
    : undefined;

  if (hasSortOrder) {
    return db
      .select()
      .from(questionBankFolders)
      .where(where)
      .orderBy(asc(questionBankFolders.sortOrder), asc(questionBankFolders.name));
  }

  return db
    .select(legacyFolderSelect)
    .from(questionBankFolders)
    .where(where)
    .orderBy(asc(questionBankFolders.name)) as Promise<QuestionBankFolderRow[]>;
}

export async function insertQuestionBankFolder(
  db: Db,
  values: {
    name: string;
    description?: string | null;
    parentId?: number | null;
    color?: string;
    createdByAdminId?: number | null;
  },
): Promise<number> {
  const { hasSortOrder } = await prepareQuestionBankFolders(db);

  if (hasSortOrder) {
    const [{ maxSort }] = await db
      .select({ maxSort: sql<number>`COALESCE(MAX(${questionBankFolders.sortOrder}), -1)` })
      .from(questionBankFolders);
    const [result] = await db.insert(questionBankFolders).values({
      name: values.name,
      description: values.description ?? null,
      parentId: values.parentId ?? null,
      color: values.color ?? "#179ca3",
      sortOrder: Number(maxSort ?? -1) + 1,
      createdByAdminId: values.createdByAdminId ?? null,
    }).$returningId();
    return result.id;
  }

  const [result] = await db.insert(questionBankFolders).values({
    name: values.name,
    description: values.description ?? null,
    parentId: values.parentId ?? null,
    color: values.color ?? "#179ca3",
    createdByAdminId: values.createdByAdminId ?? null,
  }).$returningId();
  return result.id;
}

export async function reorderQuestionBankFolders(db: Db, folderIds: number[]): Promise<void> {
  const { hasSortOrder } = await prepareQuestionBankFolders(db);
  if (!hasSortOrder) return;
  await Promise.all(
    folderIds.map((id, index) =>
      db.update(questionBankFolders).set({ sortOrder: index }).where(eq(questionBankFolders.id, id)),
    ),
  );
}

/** Delete a folder and every descendant subfolder. */
export type QuestionBankFolderQuestionDisposition = "unassign" | "delete";

export async function deleteQuestionBankFolderTree(
  db: Db,
  folderId: number,
  questionDisposition: QuestionBankFolderQuestionDisposition = "unassign",
): Promise<{ deletedFolderCount: number; affectedQuestionCount: number }> {
  const allFolders = await selectQuestionBankFolders(db);
  const folderIds = collectDescendantFolderIds(allFolders, folderId);
  if (folderIds.length === 0) return { deletedFolderCount: 0, affectedQuestionCount: 0 };

  const questionRows = await db
    .select({ id: questionBank.id })
    .from(questionBank)
    .where(inArray(questionBank.folderId, folderIds));
  const questionIds = questionRows.map((row) => row.id);
  const affectedQuestionCount = questionIds.length;

  if (questionDisposition === "delete" && questionIds.length > 0) {
    await db.delete(questionBankTagMap).where(inArray(questionBankTagMap.questionId, questionIds));
    await db.delete(questionBank).where(inArray(questionBank.id, questionIds));
  } else if (questionIds.length > 0) {
    await db.update(questionBank).set({ folderId: null }).where(inArray(questionBank.folderId, folderIds));
  }

  await db.delete(questionBankFolders).where(inArray(questionBankFolders.id, folderIds));
  return { deletedFolderCount: folderIds.length, affectedQuestionCount };
}
