import { TRPCError } from "@trpc/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  questionBank,
  questionBankFolders,
  questionBankTags,
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
  /** Optional source-question scope for a safe reimport of only missing records. */
  questionIds?: string[];
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

const MEDIA_IMAGE_TAG = "Media: Image";
const MEDIA_VIDEO_TAG = "Media: Video";

type ImportedMediaCandidate = {
  url: string;
  kind: "image" | "video";
  source: "question" | "feedback";
  label: string;
};

function resolvedMediaUrls(refs: string[], mediaMap: Map<string, string>) {
  return [...new Set(refs.map((ref) => mediaMap.get(ref)).filter((url): url is string => Boolean(url)))];
}

function buildImportedMediaCandidates(
  questionImageUrls: string[],
  questionVideoUrls: string[],
  feedbackImageUrls: string[],
  feedbackVideoUrls: string[],
): ImportedMediaCandidate[] {
  return [
    ...questionImageUrls.map((url, index) => ({ url, kind: "image" as const, source: "question" as const, label: `Question image ${index + 1}` })),
    ...questionVideoUrls.map((url, index) => ({ url, kind: "video" as const, source: "question" as const, label: `Question video ${index + 1}` })),
    ...feedbackImageUrls.map((url, index) => ({ url, kind: "image" as const, source: "feedback" as const, label: `Feedback image ${index + 1}` })),
    ...feedbackVideoUrls.map((url, index) => ({ url, kind: "video" as const, source: "feedback" as const, label: `Feedback video ${index + 1}` })),
  ];
}

async function ensureMediaTagIds(db: MySql2Database<any>): Promise<{ image: number; video: number }> {
  const names = [MEDIA_IMAGE_TAG, MEDIA_VIDEO_TAG];
  let tags = await db.select({ id: questionBankTags.id, name: questionBankTags.name })
    .from(questionBankTags)
    .where(inArray(questionBankTags.name, names));

  const existingNames = new Set(tags.map((tag) => tag.name));
  for (const [name, color] of [[MEDIA_IMAGE_TAG, "#24abbc"], [MEDIA_VIDEO_TAG, "#0e6b70"]] as const) {
    if (existingNames.has(name)) continue;
    try {
      await db.insert(questionBankTags).values({ name, color }).$returningId();
    } catch {
      // A concurrent SCORM import may have created the same globally unique tag.
    }
  }

  tags = await db.select({ id: questionBankTags.id, name: questionBankTags.name })
    .from(questionBankTags)
    .where(inArray(questionBankTags.name, names));
  const tagIdByName = new Map(tags.map((tag) => [tag.name, tag.id]));
  const image = tagIdByName.get(MEDIA_IMAGE_TAG);
  const video = tagIdByName.get(MEDIA_VIDEO_TAG);
  if (!image || !video) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Question media tags could not be prepared." });
  return { image, video };
}

async function ensureQuestionTagMappings(
  db: MySql2Database<any>,
  questionId: number,
  tagIds: number[],
) {
  const uniqueTagIds = [...new Set(tagIds)];
  if (uniqueTagIds.length === 0) return;
  const existing = await db.select({ tagId: questionBankTagMap.tagId })
    .from(questionBankTagMap)
    .where(and(
      eq(questionBankTagMap.questionId, questionId),
      inArray(questionBankTagMap.tagId, uniqueTagIds),
    ));
  const existingTagIds = new Set(existing.map((row) => row.tagId));
  const missingTagIds = uniqueTagIds.filter((tagId) => !existingTagIds.has(tagId));
  if (missingTagIds.length > 0) {
    await db.insert(questionBankTagMap).values(missingTagIds.map((tagId) => ({ questionId, tagId })));
  }
}

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
  const selectedQuestionIds = input.questionIds?.length ? new Set(input.questionIds) : null;
  const sourceQuestions = parsed.groups.flatMap((group) => group.questions);
  if (selectedQuestionIds) {
    const foundIds = new Set(sourceQuestions.map((question) => question.id));
    const missingIds = [...selectedQuestionIds].filter((id) => !foundIds.has(id));
    if (missingIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "One or more selected SCORM question IDs were not found in this package." });
  }
  const mediaRefs = selectedQuestionIds
    ? [...new Set(sourceQuestions.filter((question) => selectedQuestionIds.has(question.id)).flatMap((question) => [
      ...question.questionImageRefs,
      ...question.questionVideoRefs,
      ...question.feedbackImageRefs,
      ...question.feedbackVideoRefs,
      ...question.answers.flatMap((answer) => [answer.imageRef, answer.videoRef].filter((ref): ref is string => Boolean(ref))),
    ]))]
    : [...new Set([...parsed.allImageRefs, ...parsed.allVideoRefs])];
  let mediaMap: Map<string, string>;
  try {
    mediaMap = source.extractedPrefix
      ? await uploadISpringMediaFromExtractedPrefix(source.extractedPrefix, mediaRefs, source.mediaBasePath)
      : await uploadISpringMediaFromZip(source.zipEntries, mediaRefs, source.mediaBasePath);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown media storage error";
    // Do not log source package content, storage keys, URLs, or user/session data.
    console.error(`[QuestionBank] SCORM media preparation failed: ${detail}`);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "SCORM media could not be prepared, so no Question Bank records were saved. Check the server log for the media-preparation stage and storage configuration.",
    });
  }

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

  const groups = (input.groupIds && input.groupIds.length > 0
    ? parsed.groups.filter((g) => input.groupIds!.includes(g.id))
    : parsed.groups).map((group) => selectedQuestionIds ? { ...group, questions: group.questions.filter((question) => selectedQuestionIds.has(question.id)) } : group).filter((group) => group.questions.length > 0);

  const tagIds = scormImportQuestionTagIds(input.extraTagIds);
  const mediaTagIds = await ensureMediaTagIds(db);
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
      const questionImageUrls = resolvedMediaUrls(q.questionImageRefs, mediaMap);
      const questionVideoUrls = resolvedMediaUrls(q.questionVideoRefs, mediaMap);
      const feedbackImageUrls = resolvedMediaUrls(q.feedbackImageRefs, mediaMap);
      const feedbackVideoUrls = resolvedMediaUrls(q.feedbackVideoRefs, mediaMap);
      // Source-specific feedback always remains feedback. If a question stem carries
      // both a video and an image but has no feedback image, favour motion in the
      // question and show the still after the answer is revealed.
      const questionVideoUrl = questionVideoUrls[0] ?? null;
      const feedbackVideoUrl = feedbackVideoUrls[0] ?? null;
      const feedbackImageUrl = feedbackImageUrls[0] ?? (questionVideoUrl ? questionImageUrls[0] ?? null : null);
      const questionImageUrl = questionVideoUrl && !feedbackImageUrls[0] ? null : questionImageUrls[0] ?? null;
      const mediaCandidates = buildImportedMediaCandidates(
        questionImageUrls,
        questionVideoUrls,
        feedbackImageUrls,
        feedbackVideoUrls,
      );
      const mediaCandidatesJson = mediaCandidates.length > 0 ? JSON.stringify(mediaCandidates) : null;
      const questionTagIds = [
        ...tagIds,
        ...(questionImageUrl || feedbackImageUrl || options.some((option) => option.imageUrl) ? [mediaTagIds.image] : []),
        ...(questionVideoUrl || feedbackVideoUrl || options.some((option) => option.videoUrl) ? [mediaTagIds.video] : []),
      ];

      const [existingQuestion] = await db
        .select({
          id: questionBank.id,
          options: questionBank.options,
          questionImageUrl: questionBank.questionImageUrl,
          questionVideoUrl: questionBank.questionVideoUrl,
          feedbackImageUrl: questionBank.feedbackImageUrl,
          feedbackVideoUrl: questionBank.feedbackVideoUrl,
          mediaCandidates: questionBank.mediaCandidates,
          hotspotMarkers: questionBank.hotspotMarkers,
          matchingPairs: questionBank.matchingPairs,
          flashcardFront: questionBank.flashcardFront,
          flashcardBack: questionBank.flashcardBack,
          correctAnswers: questionBank.correctAnswers,
          scormSourceAssetId: questionBank.scormSourceAssetId,
          scormSourceQuestionId: questionBank.scormSourceQuestionId,
        })
        .from(questionBank)
        .where(and(
          eq(questionBank.folderId, groupFolderId),
          input.mediaAssetId
            ? or(
                and(eq(questionBank.scormSourceAssetId, input.mediaAssetId), eq(questionBank.scormSourceQuestionId, q.id)),
                and(eq(questionBank.question, questionText), eq(questionBank.type, q.type), eq(questionBank.correctAnswer, q.correctAnswer)),
              )
            : and(eq(questionBank.question, questionText), eq(questionBank.type, q.type), eq(questionBank.correctAnswer, q.correctAnswer)),
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
          mediaCandidates: existingQuestion.mediaCandidates ?? mediaCandidatesJson,
          hotspotMarkers: existingQuestion.hotspotMarkers ?? (q.hotspotMarkers ? JSON.stringify(q.hotspotMarkers) : null),
          matchingPairs: existingQuestion.matchingPairs ?? (q.matchingPairs ? JSON.stringify(q.matchingPairs) : null),
          flashcardFront: existingQuestion.flashcardFront ?? q.flashcardFront ?? null,
          flashcardBack: existingQuestion.flashcardBack ?? q.flashcardBack ?? null,
          correctAnswers: existingQuestion.correctAnswers ?? q.correctAnswers ?? null,
          scormSourceAssetId: existingQuestion.scormSourceAssetId ?? input.mediaAssetId ?? null,
          scormSourceQuestionId: existingQuestion.scormSourceQuestionId ?? (input.mediaAssetId ? q.id : null),
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
        await ensureQuestionTagMappings(db, existingQuestion.id, questionTagIds);
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
        mediaCandidates: mediaCandidatesJson,
        hotspotMarkers: q.hotspotMarkers ? JSON.stringify(q.hotspotMarkers) : null,
        matchingPairs: q.matchingPairs ? JSON.stringify(q.matchingPairs) : null,
        flashcardFront: q.flashcardFront ?? null,
        flashcardBack: q.flashcardBack ?? null,
        correctAnswers: q.correctAnswers ?? null,
        scormSourceAssetId: input.mediaAssetId ?? null,
        scormSourceQuestionId: input.mediaAssetId ? q.id : null,
        folderId: groupFolderId,
        createdByAdminId: adminUserId,
      }).$returningId();

      await ensureQuestionTagMappings(db, result.id, questionTagIds);

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
