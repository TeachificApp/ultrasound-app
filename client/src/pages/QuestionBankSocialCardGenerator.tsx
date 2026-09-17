import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Copy, Download, FileImage, FileVideo, Folder, ImageIcon, Loader2, Search, Upload, Video, X } from "lucide-react";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CLINICAL_QUIZ_CARD_TEMPLATES,
  ClinicalQuizCard,
  exportClinicalVideoCardAsMp4,
  renderClinicalQuizCardToPng,
  type ClinicalCardMedia,
  type ClinicalQuizCardTemplate,
} from "@/components/social/ClinicalQuizCard";
import { getBrandToolPresentation, resolveToolBrand } from "@/lib/brandToolPresentation";
import { perBrandAdminUrl } from "@/lib/perBrandUrls";
import { uploadFileToMediaRepository } from "@/lib/mediaRepoUpload";

type BankOption = { text: string; imageUrl?: string; videoUrl?: string };
type MediaFilter = "all" | "image" | "video";
const OPTION_LETTERS = ["A", "B", "C", "D"];

function stripHtml(value: string | null | undefined): string {
  return (value ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeOptions(value: unknown): BankOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((option) => typeof option === "string" ? { text: option } : option as BankOption)
    .filter((option) => typeof option?.text === "string" && stripHtml(option.text));
}

function getQuestionMedia(question: any): ClinicalCardMedia {
  const options = normalizeOptions(question.options);
  const optionVideo = options.find((option) => option.videoUrl)?.videoUrl;
  const optionImage = options.find((option) => option.imageUrl)?.imageUrl;
  if (question.questionVideoUrl) return { kind: "video", url: question.questionVideoUrl };
  if (question.questionImageUrl) return { kind: "image", url: question.questionImageUrl };
  if (optionVideo) return { kind: "video", url: optionVideo };
  if (optionImage) return { kind: "image", url: optionImage };
  if (question.feedbackVideoUrl) return { kind: "video", url: question.feedbackVideoUrl };
  if (question.feedbackImageUrl) return { kind: "image", url: question.feedbackImageUrl };
  return { kind: "none" };
}

function fileNameFor(question: any, extension: "png" | "mp4") {
  const stem = stripHtml(question?.question || "clinical-quiz-card")
    .slice(0, 52)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "clinical-quiz-card";
  return `${stem}.${extension}`;
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
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [page, setPage] = useState(1);
  const [includeSourceFolderLabel, setIncludeSourceFolderLabel] = useState(false);
  const [customCardLabel, setCustomCardLabel] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [template, setTemplate] = useState<ClinicalQuizCardTemplate>("clinical-white");
  const [media, setMedia] = useState<ClinicalCardMedia>({ kind: "none" });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [exporting, setExporting] = useState<"png" | "mp4" | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const videoBaseCardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const questionQueryInput = useMemo(() => ({
    search: search.trim() || undefined,
    folderId,
    tagIds: tagIds.length > 0 ? tagIds : undefined,
    mediaKind: mediaFilter === "all" ? undefined : mediaFilter,
    page,
    pageSize: 100,
  }), [folderId, mediaFilter, page, search, tagIds]);
  const questionsQuery = trpc.questionBank.listQuestions.useQuery(questionQueryInput);
  const foldersQuery = trpc.questionBank.listFolders.useQuery();
  const tagsQuery = trpc.questionBank.listTags.useQuery();
  const selectedQuestion = useMemo(
    () => questionsQuery.data?.questions.find((question: any) => question.id === selectedQuestionId) ?? null,
    [questionsQuery.data?.questions, selectedQuestionId],
  );
  const questionMedia = useMemo(() => selectedQuestion ? getQuestionMedia(selectedQuestion) : { kind: "none" } as ClinicalCardMedia, [selectedQuestion]);
  const mediaAssets = trpc.mediaRepo.listAssets.useQuery({ brand: presentation.brand, page: 1, pageSize: 24 });
  const options = useMemo(() => normalizeOptions(selectedQuestion?.options).map((option) => option.text), [selectedQuestion?.options]);
  const sourceFolderLabel = useMemo(() => foldersQuery.data?.find((folder: any) => folder.id === selectedQuestion?.folderId)?.name?.trim(), [foldersQuery.data, selectedQuestion?.folderId]);
  const cardLabel = useMemo(() => customCardLabel.trim() || (includeSourceFolderLabel ? sourceFolderLabel : undefined), [customCardLabel, includeSourceFolderLabel, sourceFolderLabel]);
  const caption = useMemo(() => buildSocialCaption(selectedQuestion, presentation, cardLabel), [cardLabel, selectedQuestion, presentation]);

  const selectQuestion = useCallback((question: any) => {
    setSelectedQuestionId(question.id);
    setMedia(getQuestionMedia(question));
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
    const url = asset.currentVersion?.s3Url;
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
      setMedia(file.type.startsWith("video/") ? { kind: "video", url: uploaded.s3Url } : { kind: "image", url: uploaded.s3Url });
      await mediaAssets.refetch();
      toast.success("Media uploaded to Media Repository and selected for this card.");
    } catch (error: any) {
      toast.error(error?.message ?? "Media upload failed.");
    } finally {
      setUploading(false);
    }
  }, [mediaAssets, presentation.brand]);

  const exportPng = useCallback(async () => {
    if (!cardRef.current || !selectedQuestion) return;
    setExporting("png");
    try {
      const image = await renderClinicalQuizCardToPng(cardRef.current);
      const blob = await fetch(image).then((response) => response.blob());
      saveAs(blob, fileNameFor(selectedQuestion, "png"));
    } catch {
      toast.error("PNG export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  }, [selectedQuestion]);

  const exportMp4 = useCallback(async () => {
    if (media.kind !== "video" || !videoBaseCardRef.current || !selectedQuestion) return;
    setExporting("mp4");
    try {
      await exportClinicalVideoCardAsMp4({ videoUrl: media.url, baseCardElement: videoBaseCardRef.current, fileName: fileNameFor(selectedQuestion, "mp4") });
      toast.success("MP4 export is ready.");
    } catch (error: any) {
      toast.error(error?.message ?? "MP4 export failed. Use a browser-supported MP4 video and try again.");
    } finally {
      setExporting(null);
    }
  }, [media, selectedQuestion]);

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
        </div>
      </header>

      <main className="mx-auto grid max-w-screen-2xl gap-6 px-6 py-6 xl:grid-cols-[360px_minmax(0,1fr)_330px]">
        <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <h2 className="text-sm font-bold">1. Browse all Question Bank questions</h2>
          <div className="relative mt-3"><Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" /><Input value={search} onChange={(event) => { setSearch(event.target.value); resetQuestionBrowserPage(); }} placeholder="Search all Question Bank questions" className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/35" /></div>
          <div className="mt-3 rounded-lg border border-white/10 bg-black/15 p-2.5"><div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/50"><Folder className="h-3.5 w-3.5" />Folders</div><div className="max-h-28 space-y-1 overflow-y-auto pr-1"><button onClick={() => changeFolder(undefined)} className={`w-full rounded px-2 py-1.5 text-left text-xs ${folderId === undefined ? "bg-teal-300/15 text-teal-100" : "text-white/65 hover:bg-white/5"}`}>All folders</button>{foldersQuery.data?.map((folder: any) => <button key={folder.id} onClick={() => changeFolder(folder.id)} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs ${folderId === folder.id ? "bg-teal-300/15 text-teal-100" : "text-white/65 hover:bg-white/5"}`} style={{ paddingLeft: `${8 + (folder.parentId ? 12 : 0)}px` }}><span className="truncate">{folder.name}</span><span className="ml-2 text-[10px] text-white/35">{folder.questionCount}</span></button>)}</div></div>
          <div className="mt-3"><p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/50">Tags · match all selected</p><div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto pr-1">{tagsQuery.data?.map((tag: any) => <button key={tag.id} onClick={() => toggleTag(tag.id)} className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${tagIds.includes(tag.id) ? "border-teal-200 bg-teal-300/15 text-teal-100" : "border-white/10 text-white/55 hover:border-white/30"}`}>{tag.name}</button>)}</div></div>
          <div className="mt-3"><p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/50">Linked media</p><div className="grid grid-cols-3 gap-1">{(["all", "image", "video"] as MediaFilter[]).map((value) => <button key={value} onClick={() => changeMediaFilter(value)} className={`rounded border px-1.5 py-1.5 text-[10px] font-bold capitalize ${mediaFilter === value ? "border-teal-200 bg-teal-300/15 text-teal-100" : "border-white/10 text-white/55 hover:border-white/30"}`}>{value === "all" ? "Any" : value}</button>)}</div></div>
          <div className="mt-3 text-[11px] text-white/45">{questionsQuery.data ? `${questionsQuery.data.total} matching question${questionsQuery.data.total === 1 ? "" : "s"}` : "Loading filters…"}</div>
          <div className="mt-3 max-h-[68vh] space-y-2 overflow-y-auto pr-1">
            {questionsQuery.isLoading && <div className="py-8 text-center text-sm text-white/45"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading questions</div>}
            {questionsQuery.data?.questions.map((question: any) => (
              <button key={question.id} onClick={() => selectQuestion(question)} className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedQuestionId === question.id ? "border-teal-300 bg-teal-300/10" : "border-white/10 bg-black/10 hover:border-white/25"}`}>
                <div className="line-clamp-3 text-sm font-semibold leading-relaxed text-white/90">{stripHtml(question.question)}</div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-white/45"><span>{question.type}</span>{getQuestionMedia(question).kind !== "none" && <span className="flex items-center gap-1 text-teal-200">{getQuestionMedia(question).kind === "video" ? <FileVideo className="h-3 w-3" /> : <FileImage className="h-3 w-3" />} linked {getQuestionMedia(question).kind}</span>}</div>
              </button>
            ))}
            {questionsQuery.data && questionsQuery.data.total > 0 && <div className="flex items-center justify-between gap-2 pt-2"><Button size="sm" variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="border-white/15 text-white/70 hover:bg-white/10">Previous</Button><span className="text-[10px] text-white/45">Page {page} of {totalPages}</span><Button size="sm" variant="outline" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="border-white/15 text-white/70 hover:bg-white/10">Next</Button></div>}
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-5">
          {!selectedQuestion ? (
            <div className="flex min-h-[700px] flex-col items-center justify-center text-center text-white/50"><ImageIcon className="mb-3 h-10 w-10 text-teal-200/60" /><p className="font-semibold text-white/75">Choose a Question Bank question</p><p className="mt-1 max-w-sm text-sm">The generator will prefer its existing clinical image or video. You can override it without changing the source question.</p></div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold">3. Preview and export</h2><p className="mt-1 text-xs text-white/50">Question, answers, selected card brand, and clinical media are rendered in a 1080 × 1080 social card.</p></div><div className="flex gap-2"><Button size="sm" onClick={exportPng} disabled={exporting !== null} className="gap-1.5 bg-teal-500 text-white hover:bg-teal-400"><Download className="h-3.5 w-3.5" />{exporting === "png" ? "Exporting" : "PNG"}</Button>{media.kind === "video" && <Button size="sm" onClick={exportMp4} disabled={exporting !== null} className="gap-1.5 bg-indigo-500 text-white hover:bg-indigo-400"><Video className="h-3.5 w-3.5" />{exporting === "mp4" ? "Rendering MP4" : "MP4"}</Button>}</div></div>
              <div className="overflow-auto rounded-lg border border-white/10 bg-black/20 p-4"><div style={{ width: 648, transform: "scale(0.6)", transformOrigin: "top left", height: 648 }}><div ref={cardRef}><ClinicalQuizCard presentation={presentation} template={template} question={selectedQuestion.question} options={options} media={media} title={cardLabel} footerHost={presentation.publicHost} answerContextLabel="CLINICAL QUIZ" answerFooterMessage="Follow for clinical learning" /></div></div></div>
              <div className="mt-4 rounded-lg border border-white/10 bg-black/15 p-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-teal-100">Social caption</span><Button size="sm" variant="ghost" onClick={copyCaption} className="h-7 gap-1 text-xs text-white/70 hover:bg-white/10 hover:text-white"><Copy className="h-3 w-3" />Copy</Button></div><pre className="max-h-40 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-white/60">{caption}</pre></div>
              <div style={{ position: "fixed", left: -12000, top: 0, width: 1080, pointerEvents: "none" }} aria-hidden="true"><div ref={videoBaseCardRef}><ClinicalQuizCard presentation={presentation} template={template} question={selectedQuestion.question} options={options} media={{ kind: "placeholder" }} title={cardLabel} footerHost={presentation.publicHost} answerContextLabel="CLINICAL QUIZ" answerFooterMessage="Follow for clinical learning" /></div></div>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><h2 className="text-sm font-bold">2. Card brand</h2><p className="mt-1 text-xs leading-relaxed text-white/50">The output brand is independent from the selected source question and protected route.</p><div className="mt-3 grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={() => setCardBrand("aaus")} className={`h-auto whitespace-normal border-white/15 p-2 text-left ${cardBrand === "aaus" ? "border-teal-200 bg-teal-300/15 text-teal-100" : "text-white/65 hover:bg-white/10"}`}>All About Ultrasound</Button><Button size="sm" variant="outline" onClick={() => setCardBrand("iheartecho")} className={`h-auto whitespace-normal border-white/15 p-2 text-left ${cardBrand === "iheartecho" ? "border-teal-200 bg-teal-300/15 text-teal-100" : "text-white/65 hover:bg-white/10"}`}>iHeartEcho</Button></div><p className="mt-3 text-[11px] text-teal-100">Card link: {presentation.publicHost}</p></section>
          <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><h2 className="text-sm font-bold">3. Optional card label</h2><p className="mt-1 text-xs leading-relaxed text-white/50">Add the selected question’s source folder or a custom display name. This changes only this exported card and caption.</p><label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-white/75"><input type="checkbox" checked={includeSourceFolderLabel} onChange={(event) => setIncludeSourceFolderLabel(event.target.checked)} disabled={!sourceFolderLabel} className="mt-0.5 accent-teal-400" /><span>Include source folder{sourceFolderLabel ? `: ${sourceFolderLabel}` : " (no folder on this question)"}</span></label><label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-white/50">Custom display name<Input value={customCardLabel} onChange={(event) => setCustomCardLabel(event.target.value.slice(0, 120))} placeholder="e.g., RPhS Quiz" className="mt-1.5 border-white/10 bg-white/5 text-white placeholder:text-white/35" /></label>{cardLabel && <p className="mt-2 text-[11px] text-teal-100">Output label: {cardLabel}</p>}</section>
          <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><h2 className="text-sm font-bold">4. Card style</h2><div className="mt-3 grid grid-cols-2 gap-2">{CLINICAL_QUIZ_CARD_TEMPLATES.map((item) => <button key={item.id} onClick={() => setTemplate(item.id)} className={`rounded-lg border p-2 text-left transition-colors ${template === item.id ? "border-teal-200 ring-1 ring-teal-200" : "border-white/10"}`} style={{ background: item.background, color: item.text }}><div className="h-8 rounded" style={{ background: item.accent }} /><span className="mt-2 block text-xs font-bold">{item.label}</span></button>)}</div></section>
          <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-bold">5. Clinical media</h2>{media.kind !== "none" && <Button size="sm" variant="ghost" onClick={() => setMedia({ kind: "none" })} className="h-7 gap-1 text-xs text-white/65 hover:bg-white/10 hover:text-white"><X className="h-3 w-3" />No media</Button>}</div><p className="mt-1 text-xs leading-relaxed text-white/50">Existing Question Bank media is selected first. Any override affects this social card only.</p>
            <div className="mt-3 space-y-2">{questionMedia.kind !== "none" && <Button variant="outline" size="sm" onClick={() => setMedia(questionMedia)} className="w-full justify-start gap-2 border-teal-300/30 bg-teal-300/10 text-teal-100 hover:bg-teal-300/20"><FileImage className="h-3.5 w-3.5" />Use Question Bank media</Button>}<Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full justify-start gap-2 border-white/15 text-white/80 hover:bg-white/10"><Upload className="h-3.5 w-3.5" />{uploading ? `Uploading ${uploadProgress}%` : "Upload image or video"}</Button><input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia(file); event.currentTarget.value = ""; }} /></div>
            <div className="mt-4 border-t border-white/10 pt-3"><p className="text-[11px] font-bold uppercase tracking-wide text-white/50">Media Repository</p><div className="mt-2 grid grid-cols-2 gap-2">{mediaAssets.data?.assets.filter((asset: any) => asset.mediaType === "image" || asset.mediaType === "video").map((asset: any) => <button key={asset.id} onClick={() => selectRepositoryAsset(asset)} className="overflow-hidden rounded-md border border-white/10 bg-black/20 text-left hover:border-teal-300/60"><div className="flex h-16 items-center justify-center bg-black">{asset.mediaType === "video" ? <FileVideo className="h-5 w-5 text-teal-200" /> : asset.currentVersion?.s3Url ? <img src={asset.currentVersion.s3Url} alt="" className="h-full w-full object-cover" /> : <FileImage className="h-5 w-5 text-teal-200" />}</div><span className="line-clamp-2 block p-1.5 text-[10px] text-white/70">{asset.title}</span></button>)}</div></div>
          </section>
        </aside>
      </main>
    </div>
  );
}
