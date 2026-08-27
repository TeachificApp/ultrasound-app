/**
 * Import iSpring SCORM/ZIP/.quiz media assets into native Quiz Creator standalone quizzes.
 * One standalone quiz (builderConfig) per source package.
 */
import fs from "fs";
import path from "path";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, like, or } from "drizzle-orm";
import AdmZip from "adm-zip";
import {
  convertDocumentToQuiz,
  serializeNativeQuizFile,
  type NativeQuizFile,
} from "../../shared/ispringDocumentToQuiz";
import { mediaAssets, mediaVersions, standaloneQuizzes } from "../../drizzle/schema";
import { getDb } from "../db";
import { downloadStorageObject } from "./downloadStorageObject";
import { loadLatestMediaVersionBuffer } from "./loadMediaVersionBuffer";
import {
  ISpringFlashcardDeckError,
  extractISpringBase64FromHtml,
  parseQuizFromHtml,
} from "./iSpringQuizParser";
import {
  uploadISpringImagesFromExtractedPrefix,
  uploadISpringImagesFromZip,
  type ZipEntryLike,
} from "./iSpringImageImporter";
import {
  SCORM_BACKGROUND_EXTRACT_BYTES,
  shouldUseBackgroundScormExtraction,
} from "./scormPackage";
import { serializeBuilderConfig, type QuizFile } from "./quizBuilderConfig";
import { storagePut } from "../storage";

const MEDIA_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".mp4", ".webm", ".mp3", ".wav", ".ogg", ".m4a",
]);

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
  };
  return map[ext] ?? "application/octet-stream";
}

function slugifyFileName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "imported-quiz";
}

function decodeISpringBase64(b64: string): string {
  return Buffer.from(b64.replace(/\s+/g, ""), "base64").toString("utf8").trim();
}

function findZipEntry(entries: ZipEntryLike[], suffix: string): ZipEntryLike | undefined {
  const target = suffix.toLowerCase();
  return entries.find((e) => e.entryName.toLowerCase().endsWith(target));
}

async function uploadZipMediaFiles(entries: ZipEntryLike[]): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  for (const entry of entries) {
    const normalized = entry.entryName.replace(/\\/g, "/");
    if (normalized.endsWith("/")) continue;
    const ext = normalized.slice(normalized.lastIndexOf(".")).toLowerCase();
    if (!MEDIA_EXTENSIONS.has(ext)) continue;
    const buf = entry.getData();
    if (!buf.length) continue;
    const fileName = path.basename(normalized);
    const key = `quiz-import/media/${Date.now()}-${Math.random().toString(36).slice(2)}-${fileName}`;
    const { url } = await storagePut(key, buf, mimeFromExt(ext));
    urlMap.set(normalized, url);
    urlMap.set(fileName, url);
  }
  return urlMap;
}

function collectStorageRefs(raw: unknown, refs: Set<string>): void {
  if (!raw) return;
  if (typeof raw === "string") {
    const matches = raw.match(/storage:\/\/[^\s"'<>)]+/g);
    matches?.forEach((m) => refs.add(m));
    return;
  }
  if (Array.isArray(raw)) {
    raw.forEach((item) => collectStorageRefs(item, refs));
    return;
  }
  if (typeof raw === "object") {
    for (const value of Object.values(raw as Record<string, unknown>)) {
      collectStorageRefs(value, refs);
    }
  }
}

export interface LoadedISpringDocument {
  document: unknown;
  zipEntries: ZipEntryLike[];
  extractedPrefix?: string;
  assetId: number;
  assetTitle: string;
  assetSlug: string;
}

async function getLatestVersion(assetId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  const [version] = await db
    .select()
    .from(mediaVersions)
    .where(eq(mediaVersions.assetId, assetId))
    .orderBy(desc(mediaVersions.versionNumber))
    .limit(1);
  if (!version?.s3Key) throw new TRPCError({ code: "NOT_FOUND", message: "No version found for this asset" });
  return version;
}

async function loadDocumentFromZipBuffer(zipBuffer: Buffer): Promise<{ document: unknown; zipEntries: ZipEntryLike[] }> {
  const zip = new AdmZip(zipBuffer);
  const zipEntries: ZipEntryLike[] = zip.getEntries().map((entry) => ({
    entryName: entry.entryName,
    getData: () => entry.getData(),
  }));

  const docEntry =
    findZipEntry(zipEntries, "document.json") ??
    findZipEntry(zipEntries, "data.json");
  if (docEntry) {
    return { document: JSON.parse(docEntry.getData().toString("utf8")), zipEntries };
  }

  const indexEntry = zipEntries.find(
    (e) => e.entryName.toLowerCase().endsWith("index.html") && !e.entryName.includes("__MACOSX"),
  );
  if (indexEntry) {
    const html = indexEntry.getData().toString("utf8");
    const b64 = extractISpringBase64FromHtml(html);
    if (b64) return { document: JSON.parse(decodeISpringBase64(b64)), zipEntries };
    throw new Error("Could not find iSpring quiz data in SCORM package");
  }

  throw new Error("No document.json or index.html found in package");
}

async function loadDocumentFromExtractedPrefix(prefix: string, launchFile: string): Promise<unknown> {
  const normalizedPrefix = prefix.replace(/\/$/, "");
  for (const candidate of ["document.json", "data.json", launchFile || "index.html"]) {
    const key = `${normalizedPrefix}/${candidate}`.replace(/\/+/g, "/");
    try {
      const buf = await downloadStorageObject(key);
      const text = buf.toString("utf8");
      if (candidate.endsWith(".json")) return JSON.parse(text);
      const b64 = extractISpringBase64FromHtml(text);
      if (b64) return JSON.parse(decodeISpringBase64(b64));
    } catch {
      // try next candidate
    }
  }
  throw new Error("Could not load iSpring document from extracted SCORM prefix");
}

export async function loadISpringDocumentFromMediaAsset(mediaAssetId: number): Promise<LoadedISpringDocument> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  const [asset] = await db
    .select({ id: mediaAssets.id, title: mediaAssets.title, slug: mediaAssets.slug })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, mediaAssetId), isNull(mediaAssets.deletedAt)))
    .limit(1);
  if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Media asset not found" });

  const version = await getLatestVersion(mediaAssetId);
  const fileSize = version.fileSize ?? 0;
  const status = version.scormExtractionStatus ?? "pending";
  const prefix = version.scormExtractedPrefix;
  const useBackground = shouldUseBackgroundScormExtraction({ fileSize, scormExtractionStatus: status });

  if (prefix && !prefix.startsWith("__direct_html__:") && status === "done") {
    const document = await loadDocumentFromExtractedPrefix(prefix, version.scormLaunchFile ?? "index.html");
    return {
      document,
      zipEntries: [],
      extractedPrefix: prefix.replace(/\/$/, ""),
      assetId: asset.id,
      assetTitle: asset.title,
      assetSlug: asset.slug,
    };
  }

  if (useBackground) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        `SCORM extraction is not complete for this package (${status}).` +
        (fileSize > SCORM_BACKGROUND_EXTRACT_BYTES
          ? ` Large package (${(fileSize / 1024 / 1024).toFixed(0)} MB) — wait for extraction.`
          : " Use Re-extract in Media Repository."),
    });
  }

  const zipBuffer = await loadLatestMediaVersionBuffer(mediaAssetId);
  const { document, zipEntries } = await loadDocumentFromZipBuffer(zipBuffer);
  return {
    document,
    zipEntries,
    assetId: asset.id,
    assetTitle: asset.title,
    assetSlug: asset.slug,
  };
}

async function buildMediaUrlMap(source: LoadedISpringDocument): Promise<Map<string, string>> {
  const refs = new Set<string>();
  collectStorageRefs(source.document, refs);

  const zipMediaMap = source.zipEntries.length ? await uploadZipMediaFiles(source.zipEntries) : new Map<string, string>();
  const storageMap = source.extractedPrefix
    ? await uploadISpringImagesFromExtractedPrefix(source.extractedPrefix, [...refs])
    : await uploadISpringImagesFromZip(source.zipEntries, [...refs]);

  return new Map<string, string>([...zipMediaMap, ...storageMap]);
}

function rewriteQuizMediaUrls(quiz: NativeQuizFile, urlMap: Map<string, string>): NativeQuizFile {
  const json = JSON.stringify(quiz);
  let rewritten = json;
  for (const [ref, url] of urlMap) {
    rewritten = rewritten.split(ref).join(url);
  }
  return JSON.parse(rewritten) as NativeQuizFile;
}

export async function convertMediaAssetToNativeQuiz(
  mediaAssetId: number,
): Promise<{ quizFile: NativeQuizFile; warnings: string[]; questionCount: number; mediaCount: number }> {
  let source: LoadedISpringDocument;
  try {
    source = await loadISpringDocumentFromMediaAsset(mediaAssetId);
  } catch (err) {
    if (err instanceof ISpringFlashcardDeckError) throw new TRPCError({ code: "PRECONDITION_FAILED", message: err.message });
    throw err instanceof TRPCError ? err : new TRPCError({ code: "BAD_REQUEST", message: String((err as Error).message) });
  }

  if (source.extractedPrefix) {
    try {
      const version = await getLatestVersion(mediaAssetId);
      const launchKey = `${source.extractedPrefix}/${version.scormLaunchFile ?? "index.html"}`.replace(/\/+/g, "/");
      const html = (await downloadStorageObject(launchKey)).toString("utf8");
      parseQuizFromHtml(html);
    } catch (e) {
      if (e instanceof ISpringFlashcardDeckError) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: e.message });
      }
    }
  }

  const mediaUrlMap = await buildMediaUrlMap(source);
  const warnings: string[] = [];
  let quizFile = convertDocumentToQuiz(source.document, mediaUrlMap, warnings, {
    sourceMediaAssetId: source.assetId,
    sourceMediaAssetSlug: source.assetSlug,
  });
  quizFile.meta.title = String(quizFile.meta.title || source.assetTitle);
  quizFile = rewriteQuizMediaUrls(quizFile, mediaUrlMap);

  if (quizFile.questions.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No quiz questions found in this SCORM/ZIP package" });
  }

  return {
    quizFile,
    warnings,
    questionCount: quizFile.questions.length,
    mediaCount: mediaUrlMap.size,
  };
}

export async function findExistingQuizForMediaAsset(mediaAssetId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const needle = `"scorm-import:${mediaAssetId}"`;
  const rows = await db
    .select({ id: standaloneQuizzes.id, builderConfig: standaloneQuizzes.builderConfig })
    .from(standaloneQuizzes)
    .where(like(standaloneQuizzes.builderConfig, `%${needle}%`))
    .limit(5);
  for (const row of rows) {
    try {
      const config = JSON.parse(String(row.builderConfig ?? "{}")) as QuizFile;
      if ((config.meta as { sourceMediaAssetId?: number }).sourceMediaAssetId === mediaAssetId) {
        return row.id;
      }
      if ((config.meta as { tags?: string[] }).tags?.includes(`scorm-import:${mediaAssetId}`)) {
        return row.id;
      }
    } catch {
      // ignore malformed config
    }
  }
  return null;
}

export async function saveNativeQuizFromImport(
  quizFile: NativeQuizFile,
  createdByUserId: number,
  options?: { replaceQuizId?: number | null },
): Promise<number> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  const meta = quizFile.meta as QuizFile["meta"];
  const settings = {
    title: String(meta.title ?? "Imported Quiz"),
    description: String(meta.description ?? "") || null,
    passingScore: Number(meta.passingScore ?? 70),
    timeLimitMinutes: meta.timeLimit != null ? Number(meta.timeLimit) : null,
    shuffleQuestions: Boolean(meta.shuffleQuestions),
    shuffleAnswers: Boolean(meta.shuffleAnswers),
    allowRetakes: Boolean(meta.allowRetry ?? true),
    maxAttempts: meta.maxAttempts != null ? Number(meta.maxAttempts) : null,
    showResultsImmediately: meta.showFeedback !== "never",
    showExplanations: true,
  };

  const builderConfig = serializeBuilderConfig(quizFile as QuizFile);

  if (options?.replaceQuizId) {
    await db
      .update(standaloneQuizzes)
      .set({ ...settings, builderConfig, status: "draft" })
      .where(eq(standaloneQuizzes.id, options.replaceQuizId));
    return options.replaceQuizId;
  }

  const [result] = await db.insert(standaloneQuizzes).values({
    ...settings,
    type: "quiz",
    status: "draft",
    accessType: "enrolled",
    brand: "aaus",
    builderConfig,
    createdByUserId,
  });
  const quizId = (result as { insertId: number }).insertId;
  const updatedMeta = { ...quizFile.meta, cloudId: quizId };
  await db
    .update(standaloneQuizzes)
    .set({ builderConfig: serializeBuilderConfig({ meta: updatedMeta, questions: quizFile.questions } as QuizFile) })
    .where(eq(standaloneQuizzes.id, quizId));
  return quizId;
}

export async function importMediaAssetToNativeQuiz(
  mediaAssetId: number,
  createdByUserId: number,
  options?: { replaceExisting?: boolean; exportDir?: string },
): Promise<{
  quizId: number;
  title: string;
  questionCount: number;
  mediaCount: number;
  warnings: string[];
  exportFilePath?: string;
  replaced: boolean;
}> {
  const existingId = await findExistingQuizForMediaAsset(mediaAssetId);
  if (existingId && !options?.replaceExisting) {
    const db = await getDb();
    const [existing] = await db!
      .select({ title: standaloneQuizzes.title })
      .from(standaloneQuizzes)
      .where(eq(standaloneQuizzes.id, existingId))
      .limit(1);
    return {
      quizId: existingId,
      title: existing?.title ?? "Existing Quiz",
      questionCount: 0,
      mediaCount: 0,
      warnings: ["Skipped — native quiz already exists for this media asset"],
      replaced: false,
    };
  }

  const converted = await convertMediaAssetToNativeQuiz(mediaAssetId);
  const quizId = await saveNativeQuizFromImport(converted.quizFile, createdByUserId, {
    replaceQuizId: existingId && options?.replaceExisting ? existingId : null,
  });

  let exportFilePath: string | undefined;
  if (options?.exportDir) {
    fs.mkdirSync(options.exportDir, { recursive: true });
    const baseName = slugifyFileName(String(converted.quizFile.meta.title ?? "quiz"));
    const filePath = path.join(options.exportDir, `${baseName}-${mediaAssetId}.aausquiz`);
    fs.writeFileSync(filePath, serializeNativeQuizFile(converted.quizFile), "utf8");
    exportFilePath = filePath;
  }

  return {
    quizId,
    title: String(converted.quizFile.meta.title ?? "Imported Quiz"),
    questionCount: converted.questionCount,
    mediaCount: converted.mediaCount,
    warnings: converted.warnings,
    exportFilePath,
    replaced: Boolean(existingId && options?.replaceExisting),
  };
}

export async function listImportableScormQuizAssets(limit = 200): Promise<
  Array<{ id: number; title: string; slug: string; fileName: string | null; mediaType: string }>
> {
  const db = await getDb();
  if (!db) return [];
  const assets = await db
    .select({
      id: mediaAssets.id,
      title: mediaAssets.title,
      slug: mediaAssets.slug,
      mediaType: mediaAssets.mediaType,
    })
    .from(mediaAssets)
    .where(
      and(
        or(eq(mediaAssets.mediaType, "scorm"), eq(mediaAssets.mediaType, "zip"), eq(mediaAssets.mediaType, "lms")),
        isNull(mediaAssets.deletedAt),
      ),
    )
    .orderBy(desc(mediaAssets.createdAt))
    .limit(limit);

  const enriched = await Promise.all(
    assets.map(async (asset) => {
      const [version] = await db
        .select({ fileName: mediaVersions.fileName })
        .from(mediaVersions)
        .where(eq(mediaVersions.assetId, asset.id))
        .orderBy(desc(mediaVersions.versionNumber))
        .limit(1);
      const fileName = version?.fileName ?? null;
      const isQuizLike =
        fileName?.toLowerCase().endsWith(".quiz") ||
        fileName?.toLowerCase().endsWith(".zip") ||
        asset.mediaType === "scorm" ||
        asset.mediaType === "lms";
      return isQuizLike ? { ...asset, fileName } : null;
    }),
  );

  return enriched.filter(Boolean) as Array<{
    id: number;
    title: string;
    slug: string;
    fileName: string | null;
    mediaType: string;
  }>;
}

export async function batchImportScormQuizzesToNative(
  createdByUserId: number,
  options?: {
    mediaAssetIds?: number[];
    replaceExisting?: boolean;
    exportDir?: string;
    limit?: number;
  },
): Promise<{
  created: Array<{
    mediaAssetId: number;
    quizId: number;
    title: string;
    questionCount: number;
    exportFilePath?: string;
    replaced: boolean;
  }>;
  skipped: Array<{ mediaAssetId: number; title: string; reason: string }>;
  errors: Array<{ mediaAssetId: number; title: string; error: string }>;
}> {
  const assets = options?.mediaAssetIds?.length
    ? options.mediaAssetIds.map((id) => ({ id, title: `Asset ${id}` }))
    : (await listImportableScormQuizAssets(options?.limit ?? 200)).map((a) => ({ id: a.id, title: a.title }));

  const created: Array<{
    mediaAssetId: number;
    quizId: number;
    title: string;
    questionCount: number;
    exportFilePath?: string;
    replaced: boolean;
  }> = [];
  const skipped: Array<{ mediaAssetId: number; title: string; reason: string }> = [];
  const errors: Array<{ mediaAssetId: number; title: string; error: string }> = [];

  for (const asset of assets) {
    try {
      const result = await importMediaAssetToNativeQuiz(asset.id, createdByUserId, {
        replaceExisting: options?.replaceExisting,
        exportDir: options?.exportDir,
      });
      if (result.warnings.some((w) => w.startsWith("Skipped"))) {
        skipped.push({ mediaAssetId: asset.id, title: result.title, reason: result.warnings[0]! });
      } else {
        created.push({
          mediaAssetId: asset.id,
          quizId: result.quizId,
          title: result.title,
          questionCount: result.questionCount,
          exportFilePath: result.exportFilePath,
          replaced: result.replaced,
        });
      }
    } catch (err) {
      const message = err instanceof TRPCError ? err.message : (err as Error).message;
      if (message.includes("flashcard deck")) {
        skipped.push({ mediaAssetId: asset.id, title: asset.title, reason: message });
      } else {
        errors.push({ mediaAssetId: asset.id, title: asset.title, error: message });
      }
    }
  }

  return { created, skipped, errors };
}
