export type QuestionBankFolderLike = {
  id: number;
  name: string;
  parentId: number | null;
  sortOrder?: number | null;
};

export type FlatQuestionBankFolder<T extends QuestionBankFolderLike> = T & { depth: number };

/** Depth-first folder list for nested UI selects and managers. */
export function flattenQuestionBankFolderTree<T extends QuestionBankFolderLike>(
  folders: T[],
): FlatQuestionBankFolder<T>[] {
  const byParent = new Map<number | null, T[]>();
  for (const folder of folders) {
    const parentId = folder.parentId ?? null;
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId)!.push(folder);
  }
  for (const siblings of byParent.values()) {
    siblings.sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }

  const walk = (parentId: number | null, depth: number): FlatQuestionBankFolder<T>[] =>
    (byParent.get(parentId) ?? []).flatMap((folder) => [
      { ...folder, depth },
      ...walk(folder.id, depth + 1),
    ]);

  return walk(null, 0);
}

export function questionBankFolderOptionLabel(name: string, depth: number): string {
  return `${depth > 0 ? `${"— ".repeat(depth)}` : ""}${name}`;
}

/** SCORM import only applies manually selected tags — never group names. */
export function scormImportQuestionTagIds(extraTagIds?: number[]): number[] {
  return extraTagIds ?? [];
}
