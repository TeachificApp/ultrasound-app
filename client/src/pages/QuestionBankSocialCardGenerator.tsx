import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, Copy, Download, FileImage, FileVideo, Flag, Folder, ImageIcon, LibraryBig, Loader2, Search, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CLINICAL_QUIZ_CARD_TEMPLATES,
  ClinicalQuizCard,
  type ClinicalCardMedia,
  type ClinicalQuizCardTemplate,
} from "@/components/social/ClinicalQuizCard";
import {
  DEFAULT_SOCIAL_EXPORT_PLATFORM,
  exportSocialCard,
  SocialExportControls,
  type SocialMusicOption,
  type SocialExportFormat,
  type SocialExportPlatform,
} from "@/components/social/SocialCardExport";
import { getSocialExportPreset } from "@/lib/socialCardExportPresets";
import { SocialCardFrameProvider } from "@/components/social/SocialCardFrame";
import { getBrandToolPresentation, resolveToolBrand } from "@/lib/brandToolPresentation";
import { perBrandAdminUrl } from "@/lib/perBrandUrls";
import { uploadFileToMediaRepository } from "@/lib/mediaRepoUpload";

type BankOption = { text: string; imageUrl?: string; videoUrl?: string };
type MediaFilter = "all" | "image" | "video";
const OPTION_LETTERS = ["A", "B", "C", "D"];

type QuestionCardMediaKind = "question-image" | "question-video" | "option-image" | "option-video";

type FolderBrowserEntry = { id: number; name: string; parentId?: number | null; questionCount?: number; depth: number };

function stripHtml(value: string | null | undefined): string {
  return (value ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeOptions(value: unknown): BankOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((option) => typeof option === "string" ? { text: option } : option as BankOption)
    .filter((option) => typeof option?.text === "string" && stripHtml(option.text));
}

function questionCardMediaUrl(question: any, kind: QuestionCardMediaKind, sourceUrl: string | undefined): string | undefined {
  if (!sourceUrl) return undefined;
  const questionId = Number(question?.id);
  return Number.isSafeInteger(questionId) && questionId > 0
    ? `/api/question-bank-card-media/${questionId}/${kind}`
    : sourceUrl;
}

function getQuestionMedia(question: any): ClinicalCardMedia {
  const options = normalizeOptions(question.options);
  const optionVideo = options.find((option) => option.videoUrl)?.videoUrl;
  const optionImage = options.find((option) => option.imageUrl)?.imageUrl;
  if (question.questionVideoUrl) return { kind: "video", url: questionCardMediaUrl(question, "question-video", question.questionVideoUrl)! };
  if (question.questionImageUrl) return { kind: "image", url: questionCardMediaUrl(question, "question-image", question.questionImageUrl)! };
  if (optionVideo) return { kind: "video", url: questionCardMediaUrl(question, "option-video", optionVideo)! };
  if (optionImage) return { kind: "image", url: questionCardMediaUrl(question, "option-image", optionImage)! };
  return { kind: "none" };
}

function fileStemFor(question: any, variant: "question" | "answer" | "combined") {
  const stem = stripHtml(question?.question || "clinical-quiz-card")
    .slice(0, 52)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "clinical-quiz-card";
  return `${stem}-${variant}-card`;
}

function getCorrectAnswer(question: any): string | null {
  const options = normalizeOptions(question?.options);
  const raw = question?.correctAnswer;
  const index = typeof raw === "number" ? raw : /^\d+$/.test(String(raw ?? "")) ? Number(raw) : -1;
  if (index >= 0 && index < options.length) {
    return `${OPTION_LETTERS[index] ?? String.fromCharCode(65 + index)}. ${stripHtml(options[index]?.text)}`;
  }
  const answer = stripHtml(String(raw ?? ""));
  return answer || null;
}

function flattenFolderBrowserEntries(folders: any[]): FolderBrowserEntry[] {
  const children = new Map<number | null, any[]>();
  for (const folder of folders) {
    const parentId = folder.parentId ?? null;
    children.set(parentId, [...(children.get(parentId) ?? []), folder]);
  }
  for (const siblingSet of children.values()) siblingSet.sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) || String(a.name).localeCompare(String(b.name)));
  const result: FolderBrowserEntry[] = [];
  const visited = new Set<number>();
  const visit = (parentId: number | null, depth: number) => {
    for (const folder of children.get(parentId) ?? []) {
      if (visited.has(folder.id)) continue;
      visited.add(folder.id);
      result.push({ ...folder, depth });
      visit(folder.id, depth + 1);
    }
  };
  visit(null, 0);
  for (const folder of folders) if (!visited.has(folder.id)) { visited.add(folder.id); result.push({ ...folder, depth: 0 }); visit(folder.id, 1); }
  return result;
}

function buildSocialCaption(question: any, presentation: ReturnType<typeof getBrandToolPresentation>, cardLabel?: string) {
  const options = normalizeOptions(question?.options).slice(0, 4);
  return [
    `🩺 ${presentation.displayName} Clinical Quiz: Can you answer this clinical question?`,
    ...(cardLabel ? [`Source: ${cardLabel}`] : []),
    "",
    stripHtml(question?.question),
    "",
    ...options.map((option, index) => `${OPTION_LETTERS[index] ?? String.fromCharCode(65 + index)}. ${stripHtml(option.text)}`),
    "",
    `🔗 Explore more clinical learning at ${presentation.publicHost}`,
    "",
    ...presentation.socialHashtags,
  ].join("\n");
}

export default function QuestionBankSocialCardGenerator() {
  const [location] = useLocation();
  const routePresentation = useMemo(() => getBrandToolPresentation(resolveToolBrand(location, window.location.hostname)), [location]);
  const [cardBrand, setCardBrand] = useState<"aaus" | "iheartecho">(routePresentation.brand);
  const presentation = useMemo(() => getBrandToolPresentation(cardBrand), [cardBrand]);
  const [search, setSearch] = useState("");
  const [folderId, setFolderId] = useState<number | undefined>();
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [folderSearch, setFolderSearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [page, setPage] = useState(1);
  const [includeSourceFolderLabel, setIncludeSourceFolderLabel] = useState(false);
  const [customCardLabel, setCustomCardLabel] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [savedLibraryCard, setSavedLibraryCard] = useState<any | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryBrandFilter, setLibraryBrandFilter] = useState<"all" | "aaus" | "iheartecho">("all");
  const [flagComments, setFlagComments] = useState<Record<number, string>>({});
  const [template, setTemplate] = useState<ClinicalQuizCardTemplate>("clinical-white");
  const [media, setMedia] = useState<ClinicalCardMedia>({ kind: "none" });
  const [cardVariant, setCardVariant] = useState<"question" | "answer" | "combined">("question");
  const [exportPlatform, setExportPlatform] = useState<SocialExportPlatform>(DEFAULT_SOCIAL_EXPORT_PLATFORM);
  const [exportFormat, setExportFormat] = useState<SocialExportFormat>("png");
  const [selectedMusic, setSelectedMusic] = useState<SocialMusicOption | null>(null);
  const [zoomQuestionImage, setZoomQuestionImage] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [exporting, setExporting] = useState<"png" | "mp4" | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const questionQueryInput = useMemo(() => ({
    search: search.trim() || undefined,
    folderId,
    tagIds: tagIds.length > 0 ? tagIds : undefined,
    mediaKind: mediaFilter === "all" ? undefined : mediaFilter,
    // Quiz Cards render A–D text rows. Keep image/video-answer questions in
    // native quizzes, where every answer asset can be displayed accurately.
    excludeAnswerMedia: true,
    page,
    pageSize: 100,
  }), [folderId, mediaFilter, page, search, tagIds]);
  const questionsQuery = trpc.questionBank.listQuestions.useQuery(questionQueryInput);
  const foldersQuery = trpc.questionBank.listFolders.useQuery();
  const tagsQuery = trpc.questionBank.listTags.useQuery();
  const folderBrowserEntries = useMemo(() => flattenFolderBrowserEntries(foldersQuery.data ?? []), [foldersQuery.data]);
  const visibleFolderEntries = useMemo(() => {
    const needle = folderSearch.trim().toLowerCase();
    return needle ? folderBrowserEntries.filter((folder) => folder.name.toLowerCase().includes(needle)) : folderBrowserEntries;
  }, [folderBrowserEntries, folderSearch]);
  const visibleTags = useMemo(() => {
    const needle = tagSearch.trim().toLowerCase();
    return (tagsQuery.data ?? []).filter((tag: any) => tagIds.includes(tag.id) || !needle || tag.name.toLowerCase().includes(needle));
  }, [tagIds, tagSearch, tagsQuery.data]);
  const selectedQuestion = useMemo(
    () => questionsQuery.data?.questions.find((question: any) => question.id === selectedQuestionId) ?? null,
    [questionsQuery.data?.questions, selectedQuestionId],
  );
  const activeQuestion = savedLibraryCard?.questionSnapshot ?? selectedQuestion;
  const questionMedia = useMemo(() => activeQuestion ? getQuestionMedia(activeQuestion) : { kind: "none" } as ClinicalCardMedia, [activeQuestion]);
  const mediaAssets = trpc.mediaRepo.listAssets.useQuery({ brand: presentation.brand, page: 1, pageSize: 24 });
  const musicAssets = trpc.mediaRepo.listAssets.useQuery({ brand: presentation.brand, mediaType: "audio", page: 1, pageSize: 50 });
  const options = useMemo(() => normalizeOptions(activeQuestion?.options).map((option) => option.text), [activeQuestion?.options]);
  const correctAnswer = useMemo(() => getCorrectAnswer(activeQuestion), [activeQuestion]);
  const sourceFolderLabel = useMemo(() => savedLibraryCard?.sourceFolderLabel ?? foldersQuery.data?.find((folder: any) => folder.id === activeQuestion?.folderId)?.name?.trim(), [activeQuestion?.folderId, foldersQuery.data, savedLibraryCard?.sourceFolderLabel]);
  const cardLabel = useMemo(() => customCardLabel.trim() || (includeSourceFolderLabel ? sourceFolderLabel : undefined), [customCardLabel, includeSourceFolderLabel, sourceFolderLabel]);
  const caption = useMemo(() => buildSocialCaption(activeQuestion, presentation, cardLabel), [activeQuestion, cardLabel, presentation]);
  const musicOptions = useMemo<SocialMusicOption[]>(() => (musicAssets.data?.assets ?? [])
    .map((asset: any) => ({ id: `media:${asset.id}`, title: asset.title, url: asset.currentVersion?.s3Url, source: "media_repository" as const }))
    .filter((asset: SocialMusicOption) => Boolean(asset.url)), [musicAssets.data?.assets]);
  const exportPreset = useMemo(() => getSocialExportPreset(exportPlatform), [exportPlatform]);
  const hasVideoMedia = media.kind === "video";
  const canZoomQuestionImage = cardVariant === "combined" && exportFormat === "mp4" && media.kind === "image";
  useEffect(() => {
    if (hasVideoMedia && exportFormat !== "mp4") setExportFormat("mp4");
  }, [exportFormat, hasVideoMedia]);
  const utils = trpc.useUtils();
  const savedCards = trpc.quizCardLibrary.list.useQuery(libraryBrandFilter === "all" ? undefined : { brand: libraryBrandFilter });
  /** All platform-admin library records are used so duplicate-use awareness is shared, not per-admin. */
  const libraryUsageByQuestionId = useMemo(() => {
    const counts = new Map<number, number>();
    for (const savedCard of savedCards.data ?? []) {
      const sourceQuestionId = Number(savedCard.questionBankId ?? savedCard.questionSnapshot?.id);
      if (Number.isSafeInteger(sourceQuestionId) && sourceQuestionId > 0) {
        counts.set(sourceQuestionId, (counts.get(sourceQuestionId) ?? 0) + 1);
      }
    }
    return counts;
  }, [savedCards.data]);
  const saveCardMutation = trpc.quizCardLibrary.save.useMutation({
    onSuccess: async (saved) => {
      setShowLibrary(true);
      await utils.quizCardLibrary.list.invalidate();
      const refreshed = await savedCards.refetch();
      if (refreshed.data?.some((card: any) => card.id === saved.id)) {
        toast.success("Saved and verified in the shared Quiz Card Library.");
      } else {
        toast.error("The card was saved, but the library did not refresh. Please reopen the library.");
      }
    },
    onError: (error) => toast.error(error.message || "Quiz Card Library save failed. No card was added."),
  });
  const publishCardMutation = trpc.quizCardLibrary.publish.useMutation({ onSuccess: () => void utils.quizCardLibrary.list.invalidate() });
  const flagCardMutation = trpc.quizCardLibrary.flag.useMutation({ onSuccess: () => void utils.quizCardLibrary.list.invalidate() });
  const resolveFlagMutation = trpc.quizCardLibrary.resolveFlag.useMutation({ onSuccess: () => void utils.quizCardLibrary.list.invalidate() });
  const deleteCardMutation = trpc.quizCardLibrary.delete.useMutation({ onSuccess: () => void utils.quizCardLibrary.list.invalidate() });

  const selectQuestion = useCallback((question: any) => {
    setSelectedQuestionId(question.id);
    setSavedLibraryCard(null);
    setMedia(getQuestionMedia(question));
    setCardVariant("question");
  }, []);

  const openSavedCard = useCallback((saved: any) => {
    setSavedLibraryCard(saved);
    setSelectedQuestionId(null);
    setCardBrand(saved.brand);
    setTemplate(saved.cardTemplate);
    setCardVariant(saved.cardVariant);
    setMedia(saved.mediaKind === "none" ? { kind: "none" } : { kind: saved.mediaKind, url: saved.mediaUrl });
    setCustomCardLabel(saved.customCardLabel ?? "");
    setIncludeSourceFolderLabel(Boolean(saved.sourceFolderLabel) && !saved.customCardLabel);
    setShowLibrary(false);
    toast.success("Saved Quiz Card opened.");
  }, []);

  const resetQuestionBrowserPage = useCallback(() => {
    setPage(1);
    setSelectedQuestionId(null);
  }, []);

  const changeFolder = useCallback((nextFolderId: number | undefined) => {
    setFolderId(nextFolderId);
    resetQuestionBrowserPage();
  }, [resetQuestionBrowserPage]);

  const toggleTag = useCallback((tagId: number) => {
    setTagIds((current) => current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]);
    resetQuestionBrowserPage();
  }, [resetQuestionBrowserPage]);

  const changeMediaFilter = useCallback((nextFilter: MediaFilter) => {
    setMediaFilter(nextFilter);
    resetQuestionBrowserPage();
  }, [resetQuestionBrowserPage]);

  const totalPages = Math.max(1, Math.ceil((questionsQuery.data?.total ?? 0) / 100));

  const selectRepositoryAsset = useCallback((asset: any) => {
    const url = asset.slug ? `/api/media/${asset.slug}` : asset.currentVersion?.s3Url;
    if (!url) return;
    setMedia(asset.mediaType === "video" || asset.mimeType?.startsWith("video/") ? { kind: "video", url } : { kind: "image", url });
  }, []);

  const uploadMedia = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Select an image or video file.");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const uploaded = await uploadFileToMediaRepository(file, {
        access: "private",
        folder: "social-quiz-cards",
        brand: presentation.brand,
        onProgress: setUploadProgress,
      });
      const refreshed = await mediaAssets.refetch();
      const asset = refreshed.data?.assets.find((item: any) => item.id === uploaded.assetId);
      const url = asset?.slug ? `/api/media/${asset.slug}` : uploaded.s3Url;
      setMedia(file.type.startsWith("video/") ? { kind: "video", url } : { kind: "image", url });
      toast.success("Media uploaded to Media Repository and selected for this card.");
    } catch (error: any) {
      toast.error(error?.message ?? "Media upload failed.");
    } finally {
      setUploading(false);
    }
  }, [mediaAssets, presentation.brand]);

  const exportCard = useCallback(async () => {
    if (!cardRef.current || !activeQuestion) return;
    if (hasVideoMedia && exportFormat !== "mp4") {
      setExportFormat("mp4");
      toast.error("Video source media is available as MP4 only.");
      return;
    }
    setExporting(exportFormat);
    try {
      const questionVideoUrl = media.kind === "video" ? media.url : null;
      const filename = await exportSocialCard({
        cardElement: cardRef.current,
        platform: exportPlatform,
        format: exportFormat,
        filenameStem: fileStemFor(activeQuestion, cardVariant),
        motion: cardVariant === "answer"
          ? { kind: "answer", title: activeQuestion.question, options, detail: "Review the question", answer: correctAnswer, brandName: presentation.displayName, accentColor: presentation.accentColor, logoUrl: presentation.outroLogoUrl, logoShape: presentation.outroLogoShape, outroHost: presentation.publicHost, musicUrl: selectedMusic?.url, musicBlob: selectedMusic?.localBlob, musicTitle: selectedMusic?.title, questionVideoUrl }
          : cardVariant === "combined"
            ? { kind: "combined", title: activeQuestion.question, options, answer: correctAnswer, brandName: presentation.displayName, accentColor: presentation.accentColor, logoUrl: presentation.outroLogoUrl, logoShape: presentation.outroLogoShape, outroHost: presentation.publicHost, musicUrl: selectedMusic?.url, musicBlob: selectedMusic?.localBlob, musicTitle: selectedMusic?.title, questionVideoUrl, zoomQuestionImage: canZoomQuestionImage && zoomQuestionImage }
            : { kind: "question", title: activeQuestion.question, options, brandName: presentation.displayName, accentColor: presentation.accentColor, logoUrl: presentation.outroLogoUrl, logoShape: presentation.outroLogoShape, outroHost: presentation.publicHost, musicUrl: selectedMusic?.url, musicBlob: selectedMusic?.localBlob, musicTitle: selectedMusic?.title, questionVideoUrl },
      });
      toast.success(`${exportFormat.toUpperCase()} export is ready.`, { description: filename });
    } catch (error: any) {
      toast.error(error?.message ?? `${exportFormat.toUpperCase()} export failed. Please try again.`);
    } finally {
      setExporting(null);
    }
  }, [activeQuestion, canZoomQuestionImage, cardVariant, correctAnswer, exportFormat, exportPlatform, hasVideoMedia, media, options, presentation.accentColor, presentation.displayName, presentation.outroLogoShape, presentation.outroLogoUrl, presentation.publicHost, selectedMusic?.localBlob, selectedMusic?.title, selectedMusic?.url, zoomQuestionImage]);

  const saveToLibrary = useCallback(() => {
    if (!activeQuestion) return;
    saveCardMutation.mutate({
      brand: cardBrand,
      questionBankId: selectedQuestion?.id,
      questionSnapshot: activeQuestion,
      cardTemplate: template,
      cardVariant,
      media,
      sourceFolderLabel: sourceFolderLabel || undefined,
      customCardLabel: customCardLabel.trim() || undefined,
    });
  }, [activeQuestion, cardBrand, cardVariant, customCardLabel, media, saveCardMutation, selectedQuestion?.id, sourceFolderLabel, template]);

  const copyCaption = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(caption);
      toast.success("Social caption copied.");
    } catch {
      toast.error("The caption could not be copied.");
    }
  }, [caption]);

  return (
    <div className="min-h-screen bg-[#08141b] text-white">
      <header className="border-b border-white/10 bg-[#0d2029]">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-6 py-4">
          <Link href={perBrandAdminUrl("/platform-admin", routePresentation.brand)}><Button variant="ghost" size="icon" className="text-white/70 hover:bg-white/10 hover:text-white"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-400/15 text-teal-200"><ImageIcon className="h-5 w-5" /></div>
          <div>
            <h1 className="text-base font-bold">Question Bank Quiz Card Generator</h1>
            <p className="text-xs text-white/50">Dual-brand Platform Admin tool · source questions remain unchanged</p>
          </div>
          <Badge className="ml-1 border-0 bg-teal-300/15 text-[10px] text-teal-200">Platform Admin</Badge>
          <Button size="sm" variant="outline" onClick={() => setShowLibrary((current) => !current)} className="ml-auto gap-1.5 border-white/15 text-white/75 hover:bg-white/10"><LibraryBig className="h-3.5 w-3.5" />{showLibrary ? "Close library" : "Quiz Card Library"}</Button>
        </div>
      </header>

      {showLibrary && <section className="mx-auto max-w-screen-2xl border-x border-b border-white/10 bg-[#0d2029] px-6 py-4">
        {savedCards.isError && <div className="mb-4 rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-100">Quiz Card Library could not load: {savedCards.error.message}</div>}
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-bold">Shared Quiz Card Library</h2><p className="mt-1 text-xs text-white/50">All Platform Admins can reopen, review, publish, flag with comments, or remove saved Quiz Card outputs. Source Question Bank records are never changed.</p></div><div className="flex gap-1 rounded-lg border border-white/10 p-1">{(["all", "aaus", "iheartecho"] as const).map((brand) => <button key={brand} onClick={() => setLibraryBrandFilter(brand)} className={`rounded px-2 py-1 text-[10px] font-bold ${libraryBrandFilter === brand ? "bg-teal-400/20 text-teal-100" : "text-white/50 hover:bg-white/5"}`}>{brand === "all" ? "All brands" : brand === "aaus" ? "AAUS" : "iHeartEcho"}</button>)}</div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{savedCards.isLoading && <div className="col-span-full py-5 text-center text-xs text-white/45"><Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />Loading saved Quiz Cards…</div>}{savedCards.data?.map((saved: any) => <article key={saved.id} className="rounded-lg border border-white/10 bg-black/15 p-3"><div className="flex items-start justify-between gap-2"><div className="line-clamp-2 text-sm font-semibold text-white/85">{stripHtml(saved.questionSnapshot?.question)}</div><Badge className={`shrink-0 border-0 text-[9px] ${saved.status === "published" ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-white/55"}`}>{saved.status === "published" ? "Published" : "Draft"}</Badge></div><div className="mt-2 flex flex-wrap gap-1 text-[10px] text-white/45"><span className="rounded bg-white/5 px-1.5 py-0.5">{saved.brand === "aaus" ? "All About Ultrasound" : "iHeartEcho"}</span><span className="rounded bg-white/5 px-1.5 py-0.5">{saved.cardTemplate.replace("clinical-", "")}</span>{saved.flagComment && <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-amber-200">Flagged</span>}</div>{saved.flagComment && <p className="mt-2 rounded bg-amber-400/10 p-2 text-[11px] leading-relaxed text-amber-100">{saved.flagComment}</p>}<div className="mt-3 flex flex-wrap gap-1.5"><Button size="sm" variant="outline" onClick={() => openSavedCard(saved)} className="h-7 border-white/15 px-2 text-[10px] text-white/75 hover:bg-white/10">Open</Button><Button size="sm" variant="outline" onClick={() => publishCardMutation.mutate({ id: saved.id, published: saved.status !== "published" })} className="h-7 border-white/15 px-2 text-[10px] text-white/75 hover:bg-white/10"><CheckCircle2 className="mr-1 h-3 w-3" />{saved.status === "published" ? "Unpublish" : "Publish"}</Button><Button size="sm" variant="outline" onClick={() => deleteCardMutation.mutate({ id: saved.id })} className="h-7 border-red-400/25 px-2 text-[10px] text-red-200 hover:bg-red-400/10"><Trash2 className="mr-1 h-3 w-3" />Remove</Button>{saved.flagComment && <Button size="sm" variant="outline" onClick={() => resolveFlagMutation.mutate({ id: saved.id })} className="h-7 border-amber-300/25 px-2 text-[10px] text-amber-100 hover:bg-amber-400/10">Resolve flag</Button>}</div><div className="mt-2 flex gap-1"><Input value={flagComments[saved.id] ?? ""} onChange={(event) => setFlagComments((current) => ({ ...current, [saved.id]: event.target.value.slice(0, 2000) }))} placeholder="Flag comment" className="h-7 border-white/10 bg-white/5 text-xs text-white placeholder:text-white/30" /><Button size="sm" variant="outline" disabled={!flagComments[saved.id]?.trim()} onClick={() => flagCardMutation.mutate({ id: saved.id, comment: flagComments[saved.id].trim() })} className="h-7 border-amber-300/25 px-2 text-amber-100 hover:bg-amber-400/10"><Flag className="h-3 w-3" /></Button></div></article>)}{!savedCards.isLoading && savedCards.data?.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-white/10 py-5 text-center text-xs text-white/45">Saved Quiz Cards will appear here for all Platform Admins.</div>}</div>
      </section>}

      <main className="mx-auto grid max-w-screen-2xl gap-6 px-6 py-6 xl:grid-cols-[440px_minmax(0,1fr)_330px]">
        <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <h2 className="text-sm font-bold">1. Browse all Question Bank questions</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-white/45">Questions with images or video in their answer choices stay available in native quizzes, but are excluded here because Quiz Cards use accessible A–D text answer rows.</p>
          <div className="relative mt-3"><Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" /><Input value={search} onChange={(event) => { setSearch(event.target.value); resetQuestionBrowserPage(); }} placeholder="Search all Question Bank questions" className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/35" /></div>
          <div className="mt-3 rounded-lg border border-white/10 bg-black/15 p-2.5"><div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/50"><Folder className="h-3.5 w-3.5" />Folders</div><span className="text-[10px] text-white/35">{visibleFolderEntries.length} shown</span></div><div className="relative"><Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-white/35" /><Input value={folderSearch} onChange={(event) => setFolderSearch(event.target.value)} placeholder="Find a folder" aria-label="Find a Question Bank folder" className="h-8 border-white/10 bg-white/5 pl-8 text-xs text-white placeholder:text-white/30" /></div>{folderId !== undefined && <button onClick={() => changeFolder(undefined)} className="mt-2 text-[10px] font-semibold text-teal-200 hover:text-teal-100">Clear selected folder</button>}<div className="mt-2 max-h-[42vh] min-h-40 space-y-1 overflow-y-auto rounded-md border border-white/5 bg-black/10 p-1 pr-1.5"><button onClick={() => changeFolder(undefined)} className={`flex w-full items-center rounded px-2 py-2 text-left text-xs font-semibold ${folderId === undefined ? "bg-teal-300/15 text-teal-100" : "text-white/75 hover:bg-white/5"}`}><span>All folders</span></button>{visibleFolderEntries.map((folder) => <button key={folder.id} onClick={() => changeFolder(folder.id)} className={`flex w-full items-start justify-between rounded py-2 pr-2 text-left text-xs leading-5 ${folderId === folder.id ? "bg-teal-300/15 text-teal-100" : "text-white/65 hover:bg-white/5"}`} style={{ paddingLeft: `${8 + Math.min(folder.depth, 4) * 14}px` }} title={folder.name}><span className="min-w-0 break-words"><span className="mr-1.5 text-white/30">{folder.depth ? "↳" : "•"}</span>{folder.name}</span><span className="ml-2 shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/45">{folder.questionCount}</span></button>)}{visibleFolderEntries.length === 0 && <p className="px-2 py-3 text-xs text-white/40">No folders match “{folderSearch}”.</p>}</div></div>
          <div className="mt-3 rounded-lg border border-white/10 bg-black/15 p-2.5"><div className="mb-2 flex items-center justify-between gap-2"><p className="text-[11px] font-bold uppercase tracking-wide text-white/50">Tags · match all selected</p>{tagIds.length > 0 && <button onClick={() => { setTagIds([]); resetQuestionBrowserPage(); }} className="text-[10px] font-semibold text-teal-200 hover:text-teal-100">Clear {tagIds.length}</button>}</div><div className="relative"><Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-white/35" /><Input value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} placeholder="Search tags" aria-label="Search Question Bank tags" className="h-8 border-white/10 bg-white/5 pl-8 text-xs text-white placeholder:text-white/30" /></div><div className="mt-2 flex max-h-36 flex-wrap content-start gap-1 overflow-y-auto rounded-md border border-white/5 bg-black/10 p-2 pr-1.5">{visibleTags.map((tag: any) => <button key={tag.id} onClick={() => toggleTag(tag.id)} className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${tagIds.includes(tag.id) ? "border-teal-200 bg-teal-300/15 text-teal-100" : "border-white/10 text-white/55 hover:border-white/30"}`}>{tag.name}</button>)}{visibleTags.length === 0 && <p className="px-1 py-2 text-xs text-white/40">No tags match “{tagSearch}”.</p>}</div></div>
          <div className="mt-3"><p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/50">Linked media</p><div className="grid grid-cols-3 gap-1">{(["all", "image", "video"] as MediaFilter[]).map((value) => <button key={value} onClick={() => changeMediaFilter(value)} className={`rounded border px-1.5 py-1.5 text-[10px] font-bold capitalize ${mediaFilter === value ? "border-teal-200 bg-teal-300/15 text-teal-100" : "border-white/10 text-white/55 hover:border-white/30"}`}>{value === "all" ? "Any" : value}</button>)}</div></div>
          <div className="mt-3 text-[11px] text-white/45">{questionsQuery.data ? `${questionsQuery.data.total} matching question${questionsQuery.data.total === 1 ? "" : "s"}` : "Loading filters…"}</div>
          <div className="mt-3 max-h-[68vh] space-y-2 overflow-y-auto pr-1">
            {questionsQuery.isLoading && <div className="py-8 text-center text-sm text-white/45"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading questions</div>}
            {questionsQuery.data?.questions.map((question: any) => {
              const libraryUseCount = libraryUsageByQuestionId.get(question.id) ?? 0;
              return <button key={question.id} onClick={() => selectQuestion(question)} className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedQuestionId === question.id ? "border-teal-300 bg-teal-300/10" : "border-white/10 bg-black/10 hover:border-white/25"}`}>
                <div className="line-clamp-3 text-sm font-semibold leading-relaxed text-white/90">{stripHtml(question.question)}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-white/45"><span>{question.type}</span>{getQuestionMedia(question).kind !== "none" && <span className="flex items-center gap-1 text-teal-200">{getQuestionMedia(question).kind === "video" ? <FileVideo className="h-3 w-3" /> : <FileImage className="h-3 w-3" />} linked {getQuestionMedia(question).kind}</span>}{libraryUseCount > 0 && <span className="flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 font-semibold text-amber-100" aria-label={`Previously saved to the shared Quiz Card Library ${libraryUseCount} ${libraryUseCount === 1 ? "time" : "times"}; this question can still be selected`}><LibraryBig className="h-3 w-3" />Previously used · {libraryUseCount}</span>}</div>
              </button>;
            })}
            {questionsQuery.data && questionsQuery.data.total > 0 && <div className="flex items-center justify-between gap-2 pt-2"><Button size="sm" variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="border-white/15 text-white/70 hover:bg-white/10">Previous</Button><span className="text-[10px] text-white/45">Page {page} of {totalPages}</span><Button size="sm" variant="outline" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="border-white/15 text-white/70 hover:bg-white/10">Next</Button></div>}
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-5">
          {!activeQuestion ? (
            <div className="flex min-h-[700px] flex-col items-center justify-center text-center text-white/50"><ImageIcon className="mb-3 h-10 w-10 text-teal-200/60" /><p className="font-semibold text-white/75">Choose a Question Bank question</p><p className="mt-1 max-w-sm text-sm">The generator will prefer its existing clinical image or video. You can override it without changing the source question.</p></div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold">3. Preview and export</h2><p className="mt-1 text-xs text-white/50">Export a Question or Answer card at the selected social-platform size as a full PNG or an animated MP4.</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={saveToLibrary} disabled={saveCardMutation.isPending} className="gap-1.5 border-white/15 text-white/75 hover:bg-white/10"><LibraryBig className="h-3.5 w-3.5" />Save to library</Button><Button size="sm" onClick={exportCard} disabled={exporting !== null} className="gap-1.5 bg-teal-500 text-white hover:bg-teal-400"><Download className="h-3.5 w-3.5" />{exporting ? `Rendering ${exporting.toUpperCase()}` : `Download ${exportFormat.toUpperCase()}`}</Button></div></div>
              <div className="mb-3 flex overflow-hidden rounded-lg border border-white/10"><button onClick={() => setCardVariant("question")} className={`flex-1 px-3 py-2 text-xs font-bold ${cardVariant === "question" ? "bg-teal-500 text-white" : "bg-white/[0.03] text-white/55 hover:bg-white/10"}`}>Question only</button><button onClick={() => setCardVariant("answer")} className={`flex-1 px-3 py-2 text-xs font-bold ${cardVariant === "answer" ? "bg-teal-500 text-white" : "bg-white/[0.03] text-white/55 hover:bg-white/10"}`}>Answer only</button><button onClick={() => setCardVariant("combined")} className={`flex-1 px-3 py-2 text-xs font-bold ${cardVariant === "combined" ? "bg-teal-500 text-white" : "bg-white/[0.03] text-white/55 hover:bg-white/10"}`}>Question + answer MP4</button></div>
              {canZoomQuestionImage && <label className="mb-3 flex cursor-pointer items-start gap-2 rounded-lg border border-teal-300/25 bg-teal-300/10 px-3 py-2 text-xs text-teal-50"><input type="checkbox" checked={zoomQuestionImage} onChange={(event) => setZoomQuestionImage(event.target.checked)} className="mt-0.5 accent-teal-400" /><span><strong>Magnify the clinical image in the MP4</strong><br /><span className="text-teal-100/75">The video shows the question, zooms into the full image for review, brings in the answer options, waits three seconds, then reveals the correct answer and brand outro.</span></span></label>}
              <div className="overflow-auto rounded-lg border border-white/10 bg-black/20 p-4"><div style={{ width: Math.round(exportPreset.width * Math.min(1, 640 / exportPreset.width, 760 / exportPreset.height)), height: Math.round(exportPreset.height * Math.min(1, 640 / exportPreset.width, 760 / exportPreset.height)), position: "relative" }}><div style={{ position: "absolute", top: 0, left: 0, width: exportPreset.width, height: exportPreset.height, transform: `scale(${Math.min(1, 640 / exportPreset.width, 760 / exportPreset.height)})`, transformOrigin: "top left" }}><div ref={cardRef} style={{ width: exportPreset.width, height: exportPreset.height }}><SocialCardFrameProvider platform={exportPlatform}><ClinicalQuizCard presentation={presentation} template={template} variant={cardVariant === "answer" ? "answer" : "question"} question={activeQuestion.question} options={options} media={cardVariant === "question" || cardVariant === "combined" ? media : { kind: "none" }} correctAnswer={correctAnswer} explanation={activeQuestion.explanation} title={cardLabel} footerHost={presentation.publicHost} answerContextLabel="CLINICAL QUIZ" answerFooterMessage="Follow for clinical learning" /></SocialCardFrameProvider></div></div></div></div>
              <div className="mt-4 rounded-lg border border-white/10 bg-black/15 p-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-teal-100">Social caption</span><Button size="sm" variant="ghost" onClick={copyCaption} className="h-7 gap-1 text-xs text-white/70 hover:bg-white/10 hover:text-white"><Copy className="h-3 w-3" />Copy</Button></div><pre className="max-h-40 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-white/60">{caption}</pre></div>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><h2 className="text-sm font-bold">2. Card brand</h2><p className="mt-1 text-xs leading-relaxed text-white/50">The output brand is independent from the selected source question and protected route.</p><div className="mt-3 grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={() => setCardBrand("aaus")} className={`h-auto whitespace-normal border-white/15 p-2 text-left ${cardBrand === "aaus" ? "border-teal-200 bg-teal-300/15 text-teal-100" : "text-white/65 hover:bg-white/10"}`}>All About Ultrasound</Button><Button size="sm" variant="outline" onClick={() => setCardBrand("iheartecho")} className={`h-auto whitespace-normal border-white/15 p-2 text-left ${cardBrand === "iheartecho" ? "border-teal-200 bg-teal-300/15 text-teal-100" : "text-white/65 hover:bg-white/10"}`}>iHeartEcho</Button></div><p className="mt-3 text-[11px] text-teal-100">Card link: {presentation.publicHost}</p></section>
          <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><h2 className="text-sm font-bold">3. Optional card label</h2><p className="mt-1 text-xs leading-relaxed text-white/50">Add the selected question’s source folder or a custom display name. This changes only this exported card and caption.</p><label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-white/75"><input type="checkbox" checked={includeSourceFolderLabel} onChange={(event) => setIncludeSourceFolderLabel(event.target.checked)} disabled={!sourceFolderLabel} className="mt-0.5 accent-teal-400" /><span>Include source folder{sourceFolderLabel ? `: ${sourceFolderLabel}` : " (no folder on this question)"}</span></label><label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-white/50">Custom display name<Input value={customCardLabel} onChange={(event) => setCustomCardLabel(event.target.value.slice(0, 120))} placeholder="e.g., RPhS Quiz" className="mt-1.5 border-white/10 bg-white/5 text-white placeholder:text-white/35" /></label>{cardLabel && <p className="mt-2 text-[11px] text-teal-100">Output label: {cardLabel}</p>}</section>
          <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><h2 className="text-sm font-bold">4. Platform export</h2><p className="mt-1 text-xs leading-relaxed text-white/50">{hasVideoMedia ? "Video clinical media stays in motion, so this card exports as MP4 only." : "Choose each destination’s dimensions. Combined MP4s pause for three seconds after all options, reveal the answer, then hold the selected brand website screen for 10 seconds."}</p><div className="mt-3"><SocialExportControls platform={exportPlatform} format={exportFormat} onPlatformChange={setExportPlatform} onFormatChange={setExportFormat} musicOptions={musicOptions} selectedMusic={selectedMusic} onMusicChange={setSelectedMusic} musicUploadBrand={presentation.brand} forceMp4={hasVideoMedia} compact /></div></section>
          <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><h2 className="text-sm font-bold">5. Card style</h2><div className="mt-3 grid grid-cols-2 gap-2">{CLINICAL_QUIZ_CARD_TEMPLATES.map((item) => <button key={item.id} onClick={() => setTemplate(item.id)} className={`rounded-lg border p-2 text-left transition-colors ${template === item.id ? "border-teal-200 ring-1 ring-teal-200" : "border-white/10"}`} style={{ background: item.background, color: item.text }}><div className="h-8 rounded" style={{ background: item.accent }} /><span className="mt-2 block text-xs font-bold">{item.label}</span></button>)}</div></section>
          <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-bold">6. Clinical media</h2>{media.kind !== "none" && <Button size="sm" variant="ghost" onClick={() => setMedia({ kind: "none" })} className="h-7 gap-1 text-xs text-white/65 hover:bg-white/10 hover:text-white"><X className="h-3 w-3" />No media</Button>}</div><p className="mt-1 text-xs leading-relaxed text-white/50">Existing Question Bank media is selected first. Any override affects this social card only.</p>
            <div className="mt-3 space-y-2">{questionMedia.kind !== "none" && <Button variant="outline" size="sm" onClick={() => setMedia(questionMedia)} className="w-full justify-start gap-2 border-teal-300/30 bg-teal-300/10 text-teal-100 hover:bg-teal-300/20"><FileImage className="h-3.5 w-3.5" />Use Question Bank media</Button>}<Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full justify-start gap-2 border-white/15 text-white/80 hover:bg-white/10"><Upload className="h-3.5 w-3.5" />{uploading ? `Uploading ${uploadProgress}%` : "Upload image or video"}</Button><input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia(file); event.currentTarget.value = ""; }} /></div>
            <div className="mt-4 border-t border-white/10 pt-3"><p className="text-[11px] font-bold uppercase tracking-wide text-white/50">Media Repository</p><div className="mt-2 grid grid-cols-2 gap-2">{mediaAssets.data?.assets.filter((asset: any) => asset.mediaType === "image" || asset.mediaType === "video").map((asset: any) => <button key={asset.id} onClick={() => selectRepositoryAsset(asset)} className="overflow-hidden rounded-md border border-white/10 bg-black/20 text-left hover:border-teal-300/60"><div className="flex h-16 items-center justify-center bg-black">{asset.mediaType === "video" ? <FileVideo className="h-5 w-5 text-teal-200" /> : asset.currentVersion?.s3Url ? <img src={asset.currentVersion.s3Url} alt="" className="h-full w-full object-cover" /> : <FileImage className="h-5 w-5 text-teal-200" />}</div><span className="line-clamp-2 block p-1.5 text-[10px] text-white/70">{asset.title}</span></button>)}</div></div>
          </section>
        </aside>
      </main>
    </div>
  );
}
