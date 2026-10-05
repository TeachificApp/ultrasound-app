export type LessonFlashcardGroupDraw = {
  folderId: number;
  folderName: string;
  count: number;
};

export type LessonFlashcardCard = {
  questionBankId?: number;
  front: string;
  back: string;
  hint?: string;
  imageUrl?: string;
  backImageUrl?: string;
};

export type ResolvedLessonFlashcardCard = LessonFlashcardCard & {
  /** Stable outcome key: authored cards are manual, dynamically drawn cards are bank-backed. */
  sourceKey: `manual:${number}` | `bank:${number}`;
};

/**
 * Reads persisted group-draw settings defensively. The configuration lives in a
 * lesson content block, so malformed historical data must not interrupt lesson delivery.
 */
export function normalizeLessonFlashcardGroupDraws(raw: unknown): LessonFlashcardGroupDraw[] {
  if (!Array.isArray(raw)) return [];
  const usedFolderIds = new Set<number>();
  const groups: LessonFlashcardGroupDraw[] = [];

  for (const candidate of raw) {
    const folderId = Number((candidate as { folderId?: unknown })?.folderId);
    const count = Number((candidate as { count?: unknown })?.count);
    const folderName = String((candidate as { folderName?: unknown })?.folderName ?? "").trim();
    if (!Number.isInteger(folderId) || folderId <= 0 || usedFolderIds.has(folderId)) continue;
    if (!Number.isFinite(count) || count < 1) continue;

    usedFolderIds.add(folderId);
    groups.push({
      folderId,
      folderName: folderName || `Question Bank group ${folderId}`,
      count: Math.min(Math.floor(count), 200),
    });
  }

  return groups;
}

export function authoredLessonFlashcardSourceKey(index: number): `manual:${number}` {
  return `manual:${index}`;
}

export function questionBankLessonFlashcardSourceKey(questionBankId: number): `bank:${number}` {
  return `bank:${questionBankId}`;
}

export function parseLessonFlashcardSourceKey(sourceKey: string):
  | { kind: "manual"; index: number }
  | { kind: "bank"; questionBankId: number }
  | null {
  const match = /^(manual|bank):(\d+)$/.exec(sourceKey);
  if (!match) return null;
  const id = Number(match[2]);
  if (!Number.isSafeInteger(id) || id < 0) return null;
  return match[1] === "manual" ? { kind: "manual", index: id } : { kind: "bank", questionBankId: id };
}

export function shuffleLessonFlashcards<T>(cards: T[]): T[] {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
