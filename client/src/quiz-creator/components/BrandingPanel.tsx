import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Palette, Type, Image, MessageSquare, Save, Loader2, FileArchive, Upload, X } from "lucide-react";
import { useQuizStore } from "../store/quizStore";
import { CURRENT_QUIZ_PLAYER_PATTERN, isLegacyAquaSolidQuizBranding } from "@shared/quizBrandingPattern";
import { createPptxFlashcardTemplate, type FlashcardTemplateUpload } from "../lib/pptxFlashcardTemplate";

interface BrandingPanelProps {
  quizId: number | null;
}

const PRESET_COLORS = [
  "#189aa1", "#4ad9e0", "#24abbc", "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#8b5cf6", "#ef4444", "#06b6d4", "#84cc16", "#f97316",
];

const SUPPLIED_FLASHCARD_TEMPLATE = {
  name: "All About Ultrasound + iHeartEcho Flashcard Template",
  source: "built_in" as const,
  sourcePptxUrl: "/manus-storage/FlashcardTemplate_06a4c1a7.pptx",
  frontBackgroundUrl: "/manus-storage/FlashcardTemplate-card-frame_1ffe2b53.png",
  answerBackgroundUrl: "/manus-storage/FlashcardTemplate-card-frame_1ffe2b53.png",
};

export default function BrandingPanel({ quizId }: BrandingPanelProps) {
  const updateMeta = useQuizStore((state) => state.updateMeta);
  const [primaryColor, setPrimaryColor] = useState(CURRENT_QUIZ_PLAYER_PATTERN.primaryColor);
  const [bgColor, setBgColor] = useState(CURRENT_QUIZ_PLAYER_PATTERN.backgroundColor);
  const [backgroundMode, setBackgroundMode] = useState<"solid" | "image" | "gradient">(CURRENT_QUIZ_PLAYER_PATTERN.backgroundMode);
  const [backgroundGradient, setBackgroundGradient] = useState(CURRENT_QUIZ_PLAYER_PATTERN.backgroundGradient);
  const [textColor, setTextColor] = useState(CURRENT_QUIZ_PLAYER_PATTERN.textColor);
  const [logoUrl, setLogoUrl] = useState("");
  const [fontFamily, setFontFamily] = useState("");
  const [completionMessage, setCompletionMessage] = useState("");
  const [flashcardTemplate, setFlashcardTemplate] = useState<FlashcardTemplateUpload | typeof SUPPLIED_FLASHCARD_TEMPLATE | null>(null);
  const [templateUploading, setTemplateUploading] = useState(false);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const [dirty, setDirty] = useState(false);

  const updateBranding = trpc.quizMaker.updateBranding.useMutation({
    onSuccess: () => setDirty(false),
  });
  const uploadPageMedia = trpc.auth.uploadPageMedia.useMutation();

  // Load existing branding when quizId changes
  const { data: quiz } = trpc.quizMaker.getQuiz.useQuery(
    { quizId: quizId! },
    { enabled: !!quizId }
  );

  useEffect(() => {
    if (quiz) {
      const branding = (quiz as any).builderConfig?.meta?.branding ?? {};
      const normalizeLegacySolidAqua = isLegacyAquaSolidQuizBranding(branding);
      setPrimaryColor(branding.primaryColor || CURRENT_QUIZ_PLAYER_PATTERN.primaryColor);
      setBgColor(branding.backgroundMode === "image" ? (branding.backgroundImageUrl || "") : (normalizeLegacySolidAqua ? CURRENT_QUIZ_PLAYER_PATTERN.backgroundColor : (branding.backgroundColor || CURRENT_QUIZ_PLAYER_PATTERN.backgroundColor)));
      setBackgroundMode(normalizeLegacySolidAqua ? "gradient" : (branding.backgroundMode || (branding.backgroundImageUrl ? "image" : CURRENT_QUIZ_PLAYER_PATTERN.backgroundMode)));
      setBackgroundGradient(normalizeLegacySolidAqua ? CURRENT_QUIZ_PLAYER_PATTERN.backgroundGradient : (branding.backgroundGradient || CURRENT_QUIZ_PLAYER_PATTERN.backgroundGradient));
      setTextColor(branding.textColor || CURRENT_QUIZ_PLAYER_PATTERN.textColor);
      setLogoUrl(branding.logoUrl || "");
      setFontFamily(branding.fontFamily || "");
      setFlashcardTemplate(branding.flashcardTemplate || null);
      setCompletionMessage((quiz as any).completionMessage || "");
    }
  }, [quiz]);

  const handleSave = () => {
    if (!quizId) return;
    const branding = {
      primaryColor: primaryColor || CURRENT_QUIZ_PLAYER_PATTERN.primaryColor,
      backgroundColor: backgroundMode === "image" ? "#0d1f3c" : (bgColor || CURRENT_QUIZ_PLAYER_PATTERN.backgroundColor),
      backgroundImageUrl: backgroundMode === "image" ? (bgColor || undefined) : undefined,
      backgroundMode,
      backgroundGradient: backgroundMode === "gradient" ? backgroundGradient : undefined,
      textColor: textColor || CURRENT_QUIZ_PLAYER_PATTERN.textColor,
      fontFamily: fontFamily || undefined,
      logoUrl: logoUrl || undefined,
      flashcardTemplate: flashcardTemplate || undefined,
    };
    updateBranding.mutate({
      quizId,
        brandPrimaryColor: primaryColor || null,
        brandBgColor: bgColor || null,
        backgroundMode,
        backgroundGradient: backgroundMode === "gradient" ? backgroundGradient : null,
        brandTextColor: textColor || null,
        brandLogoUrl: logoUrl || null,
        flashcardTemplate,
        brandFontFamily: fontFamily || null,
      completionMessage: completionMessage || null,
    }, {
      onSuccess: () => updateMeta({ branding }),
    });
  };

  const uploadTemplateFile = async (file: File, context: string) => {
    const dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Unable to read the template file."));
      reader.readAsDataURL(file);
    });
    const result = await uploadPageMedia.mutateAsync({
      dataUri,
      mimeType: file.type || (file.name.endsWith(".pptx") ? "application/vnd.openxmlformats-officedocument.presentationml.presentation" : "image/png"),
      fileName: file.name,
      context,
    });
    return result.url;
  };

  const handleTemplateUpload = async (file: File) => {
    setTemplateUploading(true);
    try {
      const template = await createPptxFlashcardTemplate(file, uploadTemplateFile);
      setFlashcardTemplate(template);
      setDirty(true);
      toast.success("Flashcard design extracted. Save the quiz to apply it.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to import the PowerPoint template.");
    } finally {
      setTemplateUploading(false);
      if (templateInputRef.current) templateInputRef.current.value = "";
    }
  };

  if (!quizId) {
    return (
      <div className="p-6 text-center text-gray-400 text-sm">
        <Palette className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Save your quiz to cloud first to customize branding.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <Palette className="w-4 h-4" /> All About Ultrasound | iHeartEcho Branding
        </h3>
        <button
          onClick={handleSave}
          disabled={!dirty || updateBranding.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-40 transition-colors"
        >
          {updateBranding.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save
        </button>
      </div>
      <p className="-mt-3 text-xs text-gray-500">Apply consistent branding to reusable learning content.</p>

      {/* Primary Color */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5" /> Primary Color
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setPrimaryColor(c); setDirty(true); }}
              className={`w-7 h-7 rounded-full border-2 transition-all ${primaryColor === c ? "border-gray-800 scale-110" : "border-transparent hover:scale-105"}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => { setPrimaryColor(e.target.value); setDirty(true); }}
            className="w-7 h-7 rounded-full cursor-pointer border-0"
          />
        </div>
        <p className="text-[11px] text-gray-400">Used for buttons, progress bar, and accents in the quiz player.</p>
      </div>

      {/* Background Design */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-600">Player Background Pattern</label>
        <p className="text-[11px] text-gray-400">Current pattern: aqua center glow fading into dark navy.</p>
        <select
          value={backgroundMode}
          onChange={(event) => { setBackgroundMode(event.target.value as "solid" | "image" | "gradient"); setDirty(true); }}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
        >
          <option value="solid">Solid color</option>
          <option value="gradient">Gradient</option>
          <option value="image">Background image</option>
        </select>
        {backgroundMode === "solid" && <div className="flex items-center gap-2">
          <input
            type="color"
            value={bgColor || CURRENT_QUIZ_PLAYER_PATTERN.backgroundColor}
            onChange={(e) => { setBgColor(e.target.value); setDirty(true); }}
            className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200"
          />
          <input
            type="text"
            value={bgColor}
            onChange={(e) => { setBgColor(e.target.value); setDirty(true); }}
            placeholder={CURRENT_QUIZ_PLAYER_PATTERN.backgroundColor}
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
          {bgColor && (
            <button onClick={() => { setBgColor(""); setDirty(true); }} className="text-xs text-gray-400 hover:text-gray-600">
              Reset
            </button>
          )}
        </div>}
        {backgroundMode === "gradient" && (
          <input
            type="text"
            value={backgroundGradient}
            onChange={(event) => { setBackgroundGradient(event.target.value); setDirty(true); }}
            placeholder={CURRENT_QUIZ_PLAYER_PATTERN.backgroundGradient}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
        )}
        {backgroundMode === "image" && (
          <input
            type="url"
            value={bgColor}
            onChange={(event) => { setBgColor(event.target.value); setDirty(true); }}
            placeholder="https://example.com/quiz-background.jpg"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-600">Player Text Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={textColor}
            onChange={(event) => { setTextColor(event.target.value); setDirty(true); }}
            className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200"
          />
          <input
            type="text"
            value={textColor}
            onChange={(event) => { setTextColor(event.target.value); setDirty(true); }}
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
        </div>
      </div>

      {/* Logo URL */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
          <Image className="w-3.5 h-3.5" /> Logo URL
        </label>
        <input
          type="text"
          value={logoUrl}
          onChange={(e) => { setLogoUrl(e.target.value); setDirty(true); }}
          placeholder="https://example.com/logo.png"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
        />
        {logoUrl && (
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
            <img src={logoUrl} alt="Preview" className="h-8 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
            <span className="text-[11px] text-gray-400">Logo preview</span>
          </div>
        )}
        <p className="text-[11px] text-gray-400">Displayed on the start screen and during the quiz.</p>
      </div>

      {/* Font Family */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5" /> Font Family
        </label>
        <select
          value={fontFamily}
          onChange={(e) => { setFontFamily(e.target.value); setDirty(true); }}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
        >
          <option value="">System Default</option>
          <option value="Inter">Inter</option>
          <option value="Poppins">Poppins</option>
          <option value="Roboto">Roboto</option>
          <option value="Open Sans">Open Sans</option>
          <option value="Lato">Lato</option>
          <option value="Montserrat">Montserrat</option>
          <option value="Nunito">Nunito</option>
          <option value="Raleway">Raleway</option>
          <option value="Source Sans Pro">Source Sans Pro</option>
          <option value="Playfair Display">Playfair Display</option>
        </select>
      </div>

      {(quiz as any)?.type === "flashcards" && (
        <div className="space-y-3 border-t border-gray-100 pt-5">
          <div>
            <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
              <FileArchive className="w-3.5 h-3.5" /> Flashcard Design Template
            </label>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-400">Use the supplied card design or upload a portrait PowerPoint (.pptx). The editable prompt, answer, and card controls remain above the design shell.</p>
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3">
            <div className="flex items-start gap-3">
              <img src={SUPPLIED_FLASHCARD_TEMPLATE.frontBackgroundUrl} alt="Supplied flashcard design" className="h-24 w-14 rounded-md object-cover shadow-sm" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-teal-950">All About Ultrasound + iHeartEcho card design</p>
                <p className="mt-1 text-[11px] leading-4 text-teal-800">Vertical teal card shell with a clean editable content area.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setFlashcardTemplate(SUPPLIED_FLASHCARD_TEMPLATE); setDirty(true); }} className="rounded-md bg-teal-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-700">{flashcardTemplate?.name === SUPPLIED_FLASHCARD_TEMPLATE.name ? "Selected" : "Use this design"}</button>
                  <a href={SUPPLIED_FLASHCARD_TEMPLATE.sourcePptxUrl} target="_blank" rel="noreferrer" className="rounded-md border border-teal-200 bg-white px-2.5 py-1 text-[11px] font-medium text-teal-700 hover:bg-teal-50">Download PPTX</a>
                </div>
              </div>
            </div>
          </div>

          {flashcardTemplate && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-start gap-3">
                <img src={flashcardTemplate.frontBackgroundUrl} alt="Selected flashcard design" className="h-20 w-12 rounded object-cover shadow-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-gray-800">{flashcardTemplate.name}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">{flashcardTemplate.source === "pptx" ? "Custom PowerPoint design" : "Supplied design"}</p>
                </div>
                <button type="button" onClick={() => { setFlashcardTemplate(null); setDirty(true); }} className="rounded p-1 text-gray-400 hover:bg-white hover:text-red-600" aria-label="Remove flashcard design"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )}

          <input ref={templateInputRef} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleTemplateUpload(file); }} />
          <button type="button" disabled={templateUploading} onClick={() => templateInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-teal-300 px-3 py-2.5 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50">
            {templateUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {templateUploading ? "Extracting PowerPoint design…" : "Upload a PowerPoint card design (.pptx)"}
          </button>
        </div>
      )}

      {/* Completion Message */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" /> Completion Message
        </label>
        <textarea
          value={completionMessage}
          onChange={(e) => { setCompletionMessage(e.target.value); setDirty(true); }}
          placeholder="Congratulations! You've completed the quiz."
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-400 resize-none"
        />
        <p className="text-[11px] text-gray-400">Shown on the results screen instead of the default "Quiz Passed!" message.</p>
      </div>

      {/* Preview */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-medium text-gray-600 mb-2">Preview</p>
        <div className="rounded-xl p-4 text-center" style={{ background: backgroundMode === "gradient" ? backgroundGradient : backgroundMode === "image" && bgColor ? `url(${bgColor}) center/cover` : (bgColor || CURRENT_QUIZ_PLAYER_PATTERN.backgroundColor), color: textColor }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-8 mx-auto mb-2 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
          ) : (
            <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: primaryColor }}>
              <span className="text-white text-sm font-bold">Q</span>
            </div>
          )}
          <p className="text-sm font-bold" style={{ fontFamily: fontFamily || undefined }}>
            Sample Quiz Title
          </p>
          <button className="mt-2 px-4 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: primaryColor }}>
            Start Quiz
          </button>
        </div>
      </div>
    </div>
  );
}
