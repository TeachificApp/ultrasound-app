import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  questionBank,
  questionBankFolders,
  questionBankTagMap,
} from "../../drizzle/schema";
import {
  rewriteStorageRefs,
  uploadISpringMediaFromExtractedPrefix,
  uploadISpringMediaFromZip,
} from "./iSpringImageImporter";
import {
  loadScormImportFromBase64,
  loadScormImportFromMediaAsset,
  loadScormImportFromStorageKey,
} from "./scormQuestionBankImport";
import {
  plainTextFromISpring,
  plainTextFromISpringContent,
  richTextFromISpringContent,
} from "./questionBankImportSanitize";
import { insertQuestionBankFolder } from "./questionBankFolderQueries";
import { scormImportQuestionTagIds } from "../../shared/questionBankFolders";

export type ScormImportConfirmInput = {
  mediaAssetId?: number;
  importStorageKey?: string;
  bufferBase64?: string;
  groupIds?: string[];
  extraTagIds?: number[];
  folderId?: number;
  newFolderName?: string;
  parentFolderId?: number;
  /** When false, omit questionBankIds from the response (smaller payload). */
  includeQuestionBankIds?: boolean;
};

export type ScormImportConfirmResult = {
  results: { groupName: string; inserted: number; updated: number }[];
  totalInserted: number;
  totalUpdated: number;
  questionBankIds?: number[];
};

export async function commitScormImportToQuestionBank(
  db: MySql2Database<any>,
  adminUserId: number,
  input: ScormImportConfirmInput,
): Promise<ScormImportConfirmResult> {
  const source = input.mediaAssetId
    ? await loadScormImportFromMediaAsset(input.mediaAssetId)
    : input.importStorageKey
      ? await loadScormImportFromStorageKey(input.importStorageKey)
      : input.bufferBase64
        ? await loadScormImportFromBase64(input.bufferBase64)
        : (() => { throw new TRPCError({ code: "BAD_REQUEST", message: "Provide mediaAssetId, importStorageKey, or bufferBase64 for SCORM import" }); })();

  const parsed = source.parsed;
  const mediaRefs = [...new Set([...parsed.allImageRefs, ...parsed.allVideoRefs])];
  const mediaMap = source.extractedPrefix
    ? await uploadISpringMediaFromExtractedPrefix(source.extractedPrefix, mediaRefs)
    : await uploadISpringMediaFromZip(source.zipEntries, mediaRefs);

  let resolvedFolderId: number | null = null;
  if (input.newFolderName?.trim()) {
    resolvedFolderId = await insertQuestionBankFolder(db, {
      name: input.newFolderName.trim(),
      parentId: input.parentFolderId ?? null,
      createdByAdminId: adminUserId,
    });
  } else if (input.folderId) {
    resolvedFolderId = input.folderId;
  }

  const groups = input.groupIds && input.groupIds.length > 0
    ? parsed.groups.filter((g) => input.groupIds!.includes(g.id))
    : parsed.groups;

  const tagIds = scormImportQuestionTagIds(input.extraTagIds);
  const results: { groupName: string; inserted: number; updated: number }[] = [];
  const questionBankIds: number[] = [];
  const includeQuestionBankIds = input.includeQuestionBankIds !== false;

  for (const group of groups) {
    const groupName = plainTextFromISpring(group.name) || `Group ${results.length + 1}`;
    const [existingGroupFolder] = await db
      .select({ id: questionBankFolders.id })
      .from(questionBankFolders)
      .where(and(
        eq(questionBankFolders.name, groupName),
        resolvedFolderId === null
          ? sql`${questionBankFolders.parentId} IS NULL`
          : eq(questionBankFolders.parentId, resolvedFolderId),
      ))
      .limit(1);
    const groupFolderId = existingGroupFolder?.id ?? await insertQuestionBankFolder(db, {
      name: groupName,
      parentId: resolvedFolderId,
      createdByAdminId: adminUserId,
    });
    let inserted = 0;
    let updated = 0;

    for (const q of group.questions) {
      const questionText = richTextFromISpringContent(
        q.questionText,
        q.questionHtml,
        (value) => rewriteStorageRefs(value, mediaMap),
      );
      const options = q.answers.map((a) => ({
        text: plainTextFromISpringContent(
          a.text,
          a.html,
          (value) => rewriteStorageRefs(value, mediaMap),
        ),
        ...(a.imageRef ? { imageUrl: mediaMap.get(a.imageRef) ?? a.imageRef } : {}),
        ...(a.videoRef ? { videoUrl: mediaMap.get(a.videoRef) ?? a.videoRef } : {}),
      }));
      const explanation = plainTextFromISpringContent(
        q.explanationText,
        q.explanationHtml,
        (value) => rewriteStorageRefs(value, mediaMap),
      ) || null;
      const questionImageUrl = q.questionImageRefs.map((ref) => mediaMap.get(ref)).find(Boolean) ?? null;
      const questionVideoUrl = q.questionVideoRefs.map((ref) => mediaMap.get(ref)).find(Boolean) ?? null;
      const feedbackImageUrl = q.feedbackImageRefs.map((ref) => mediaMap.get(ref)).find(Boolean) ?? null;
      const feedbackVideoUrl = q.feedbackVideoRefs.map((ref) => mediaMap.get(ref)).find(Boolean) ?? null;

      const [existingQuestion] = await db
        .select({
          id: questionBank.id,
          options: questionBank.options,
          questionImageUrl: questionBank.questionImageUrl,
          questionVideoUrl: questionBank.questionVideoUrl,
          feedbackImageUrl: questionBank.feedbackImageUrl,
          feedbackVideoUrl: questionBank.feedbackVideoUrl,
          hotspotMarkers: questionBank.hotspotMarkers,
          correctAnswers: questionBank.correctAnswers,
        })
        .from(questionBank)
        .where(and(
          eq(questionBank.question, questionText),
          eq(questionBank.type, q.type),
          eq(questionBank.correctAnswer, q.correctAnswer),
          eq(questionBank.folderId, groupFolderId),
        ))
        .limit(1);

      if (existingQuestion) {
        const existingOptions = typeof existingQuestion.options === "string"
          ? (() => { try { const parsedOptions = JSON.parse(existingQuestion.options); return Array.isArray(parsedOptions) ? parsedOptions : []; } catch { return []; } })()
          : Array.isArray(existingQuestion.options) ? existingQuestion.options : [];
        const mergedOptions = options.map((option, index) => {
          const existingOption = existingOptions[index] ?? {};
          return {
            ...option,
            ...(existingOption.imageUrl && !option.imageUrl ? { imageUrl: existingOption.imageUrl } : {}),
            ...(existingOption.videoUrl && !option.videoUrl ? { videoUrl: existingOption.videoUrl } : {}),
          };
        });
        const updatedMedia = {
          questionImageUrl: existingQuestion.questionImageUrl ?? questionImageUrl,
          questionVideoUrl: existingQuestion.questionVideoUrl ?? questionVideoUrl,
          feedbackImageUrl: existingQuestion.feedbackImageUrl ?? feedbackImageUrl,
          feedbackVideoUrl: existingQuestion.feedbackVideoUrl ?? feedbackVideoUrl,
          hotspotMarkers: existingQuestion.hotspotMarkers ?? (q.hotspotMarkers ? JSON.stringify(q.hotspotMarkers) : null),
          correctAnswers: existingQuestion.correctAnswers ?? q.correctAnswers ?? null,
        };
        const mergedOptionsJson = JSON.stringify(mergedOptions);
        const optionsChanged = mergedOptionsJson !== JSON.stringify(existingOptions);
        const mediaChanged = Object.entries(updatedMedia).some(([key, value]) => value !== (existingQuestion as any)[key]);
        if (optionsChanged || mediaChanged) {
          await db.update(questionBank).set({
            ...(optionsChanged ? { options: mergedOptionsJson } : {}),
            ...updatedMedia,
          }).where(eq(questionBank.id, existingQuestion.id));
          updated++;
        }
        if (includeQuestionBankIds) questionBankIds.push(existingQuestion.id);
        continue;
      }

      const [result] = await db.insert(questionBank).values({
        question: questionText,
        type: q.type,
        options: JSON.stringify(options),
        correctAnswer: q.correctAnswer,
        explanation,
        questionImageUrl,
        questionVideoUrl,
        feedbackImageUrl,
        feedbackVideoUrl,
        hotspotMarkers: q.hotspotMarkers ? JSON.stringify(q.hotspotMarkers) : null,
        correctAnswers: q.correctAnswers ?? null,
        folderId: groupFolderId,
        createdByAdminId: adminUserId,
      }).$returningId();

      if (tagIds.length > 0) {
        await db.insert(questionBankTagMap).values(
          tagIds.map((tid) => ({ questionId: result.id, tagId: tid })),
        );
      }

      if (includeQuestionBankIds) questionBankIds.push(result.id);
      inserted++;
    }

    results.push({ groupName, inserted, updated });
  }

  const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
  const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
  return {
    results,
    totalInserted,
    totalUpdated,
    ...(includeQuestionBankIds ? { questionBankIds } : {}),
  };
}
