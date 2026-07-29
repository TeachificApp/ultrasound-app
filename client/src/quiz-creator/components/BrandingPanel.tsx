import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Palette, Type, Image, MessageSquare, Save, Loader2 } from "lucide-react";

interface BrandingPanelProps {
  quizId: number | null;
}

const PRESET_COLORS = [
  "#24abbc", "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#8b5cf6", "#ef4444", "#06b6d4", "#84cc16", "#f97316",
];

export default function BrandingPanel({ quizId }: BrandingPanelProps) {
  const [primaryColor, setPrimaryColor] = useState("#24abbc");
  const [bgColor, setBgColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [fontFamily, setFontFamily] = useState("");
  const [completionMessage, setCompletionMessage] = useState("");
  const [dirty, setDirty] = useState(false);

  const updateBranding = trpc.quizMaker.updateBranding.useMutation({
    onSuccess: () => setDirty(false),
  });

  // Load existing branding when quizId changes
  const { data: quiz } = trpc.quizMaker.getQuiz.useQuery(
    { quizId: quizId! },
    { enabled: !!quizId }
  );

  useEffect(() => {
    if (quiz) {
      setPrimaryColor((quiz as any).brandPrimaryColor || "#24abbc");
      setBgColor((quiz as any).brandBgColor || "");
      setLogoUrl((quiz as any).brandLogoUrl || "");
      setFontFamily((quiz as any).brandFontFamily || "");
      setCompletionMessage((quiz as any).completionMessage || "");
    }
  }, [quiz]);

  const handleSave = () => {
    if (!quizId) return;
    updateBranding.mutate({
      quizId,
      brandPrimaryColor: primaryColor || null,
      brandBgColor: bgColor || null,
      brandLogoUrl: logoUrl || null,
      brandFontFamily: fontFamily || null,
      completionMessage: completionMessage || null,
    });
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
          <Palette className="w-4 h-4" /> Quiz Branding
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

      {/* Background Color */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-600">Background Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={bgColor || "#f0fdfa"}
            onChange={(e) => { setBgColor(e.target.value); setDirty(true); }}
            className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200"
          />
          <input
            type="text"
            value={bgColor}
            onChange={(e) => { setBgColor(e.target.value); setDirty(true); }}
            placeholder="#f0fdfa (default teal gradient)"
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
          {bgColor && (
            <button onClick={() => { setBgColor(""); setDirty(true); }} className="text-xs text-gray-400 hover:text-gray-600">
              Reset
            </button>
          )}
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
        <div className="rounded-xl p-4 text-center" style={{ background: bgColor ? `linear-gradient(135deg, ${bgColor}, ${bgColor}dd)` : "linear-gradient(135deg, #f0fdfa, #e6f7f8)" }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-8 mx-auto mb-2 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
          ) : (
            <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: primaryColor }}>
              <span className="text-white text-sm font-bold">Q</span>
            </div>
          )}
          <p className="text-sm font-bold text-gray-800" style={{ fontFamily: fontFamily || undefined }}>
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
