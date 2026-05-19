/**
 * LessonEffectEditor — Admin panel for configuring per-lesson effects:
 * banner message (with duration), sound effect, and confetti cannon/fall.
 *
 * Fix log:
 * - effectBannerDuration now included in shallow lesson list query (server fix)
 * - useEffect only re-syncs when initialData.effectEnabled/effectBannerDuration
 *   actually change (stable dep comparison) — prevents reset after save
 * - Added confetti mode: Fall (gentle) vs Cannon (burst from sides)
 */
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Sparkles, Volume2, Megaphone, Save, Play, Clock, CheckCircle2, Wind, Zap } from "lucide-react";

// ─── Built-in sound presets ────────────────────────────────────────────────────
export const SOUND_PRESETS: { value: string; label: string; url: string }[] = [
  { value: "none", label: "No sound", url: "" },
  { value: "applause", label: "Applause", url: "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3" },
  { value: "cheer", label: "Crowd Cheer", url: "https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3" },
  { value: "ding", label: "Ding / Bell", url: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" },
  { value: "fanfare", label: "Fanfare", url: "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3" },
  { value: "success", label: "Success Chime", url: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3" },
  { value: "levelup", label: "Level Up", url: "https://assets.mixkit.co/active_storage/sfx/1997/1997-preview.mp3" },
  { value: "notification", label: "Notification", url: "https://assets.mixkit.co/active_storage/sfx/2355/2355-preview.mp3" },
  { value: "custom", label: "Custom MP3 URL…", url: "" },
];

// ─── Banner message presets ──────────────────────────────────────────────────────
const BANNER_PRESETS: string[] = [
  "You've just completed your first module! 🎉🥳",
  "Well done! ✨",
  "One more down! You're on fire 🔥",
  "You're on a roll! 🤩",
  "You've got this! 💥",
  "Nice work! ✨",
  "Great job! 🌟",
  "You're on it! Keep it up ⚡️",
  "You're on fire 🔥",
  "Keep Crushing It. ✨",
  "Learning Looks Good On You 😍",
  "One Step Closer to Mastery 🎓",
  "Knowledge Builds Confidence. Keep Going.",
  "✔ Module Complete",
  "Lesson Complete ✔",
];

// ─── Confetti color themes ─────────────────────────────────────────────────────
const CONFETTI_THEMES: { value: string; label: string; colors: string[] }[] = [
  { value: "rainbow", label: "Rainbow", colors: ["#ff0000","#ff7700","#ffff00","#00cc00","#0000ff","#8b00ff"] },
  { value: "gold", label: "Gold & White", colors: ["#ffd700","#ffec80","#ffffff","#c8a200"] },
  { value: "teal", label: "Brand Teal", colors: ["#179ca3","#4ad9e0","#0e4a50","#ffffff"] },
  { value: "pink", label: "Pink & Purple", colors: ["#ff69b4","#da70d6","#9370db","#ff1493"] },
  { value: "custom", label: "Custom colors…", colors: [] },
];

interface LessonEffectEditorProps {
  lessonId: number;
  initialData?: {
    effectEnabled?: boolean | null;
    effectTrigger?: string | null;
    effectBannerText?: string | null;
    effectBannerBgColor?: string | null;
    effectBannerTextColor?: string | null;
    effectSound?: string | null;
    effectSoundUrl?: string | null;
    effectConfetti?: boolean | null;
    effectConfettiColors?: string | null;
    effectConfettiMode?: string | null;
    effectBannerDuration?: number | null;
  };
  onSaved?: () => void;
}

export default function LessonEffectEditor({ lessonId, initialData, onSaved }: LessonEffectEditorProps) {
  // Track whether we've already initialised from initialData so we don't
  // overwrite user edits every time the parent re-renders.
  const initializedRef = useRef(false);

  const [enabled, setEnabled] = useState(initialData?.effectEnabled ?? false);
  const [trigger, setTrigger] = useState<"lesson_start" | "lesson_complete">(
    (initialData?.effectTrigger as "lesson_start" | "lesson_complete") ?? "lesson_start"
  );
  const [bannerText, setBannerText] = useState(initialData?.effectBannerText ?? "");
  const [bannerBg, setBannerBg] = useState(initialData?.effectBannerBgColor ?? "#179ca3");
  const [bannerTextColor, setBannerTextColor] = useState(initialData?.effectBannerTextColor ?? "#ffffff");
  const [bannerDuration, setBannerDuration] = useState(initialData?.effectBannerDuration ?? 5);
  const [soundPreset, setSoundPreset] = useState(initialData?.effectSound ?? "none");
  const [customSoundUrl, setCustomSoundUrl] = useState(initialData?.effectSoundUrl ?? "");
  const [confetti, setConfetti] = useState(initialData?.effectConfetti ?? false);
  const [confettiMode, setConfettiMode] = useState<"fall" | "cannon">((initialData?.effectConfettiMode as "fall" | "cannon") ?? "fall");
  const [confettiTheme, setConfettiTheme] = useState("rainbow");
  const [customColors, setCustomColors] = useState(initialData?.effectConfettiColors ?? "");
  const [savedState, setSavedState] = useState<typeof initialData | null>(initialData ?? null);

  // Sync state when initialData arrives for the first time (full lesson load).
  // After that, user edits take precedence — we only re-sync if the lesson ID changes.
  useEffect(() => {
    if (!initialData) return;
    // Only sync once per lessonId (the key prop on the parent resets the component
    // when the lesson changes, so we just need to guard against repeated renders
    // of the same lesson while the user is editing).
    if (initializedRef.current) return;
    initializedRef.current = true;

    setEnabled(initialData.effectEnabled ?? false);
    setTrigger((initialData.effectTrigger as "lesson_start" | "lesson_complete") ?? "lesson_start");
    setBannerText(initialData.effectBannerText ?? "");
    setBannerBg(initialData.effectBannerBgColor ?? "#179ca3");
    setBannerTextColor(initialData.effectBannerTextColor ?? "#ffffff");
    setBannerDuration(initialData.effectBannerDuration ?? 5);
    setSoundPreset(initialData.effectSound ?? "none");
    setCustomSoundUrl(initialData.effectSoundUrl ?? "");
    setConfetti(initialData.effectConfetti ?? false);
    setConfettiMode((initialData.effectConfettiMode as "fall" | "cannon") ?? "fall");
    setSavedState(initialData);

    // Sync confetti theme from saved colors
    if (initialData.effectConfettiColors) {
      const saved = initialData.effectConfettiColors;
      const match = CONFETTI_THEMES.find(t => t.colors.join(",") === saved);
      if (match) setConfettiTheme(match.value);
      else { setConfettiTheme("custom"); setCustomColors(saved); }
    } else {
      setConfettiTheme("rainbow");
      setCustomColors("");
    }
  }, [initialData]);

  const updateEffect = trpc.lmsAdmin.updateLessonEffect.useMutation({
    onSuccess: () => {
      toast.success("Effect settings saved.");
      const newState = {
        effectEnabled: enabled,
        effectTrigger: trigger,
        effectBannerText: bannerText || undefined,
        effectBannerBgColor: bannerBg,
        effectBannerTextColor: bannerTextColor,
        effectSound: soundPreset !== "none" ? soundPreset : undefined,
        effectSoundUrl: soundPreset === "custom" ? customSoundUrl : (SOUND_PRESETS.find(p => p.value === soundPreset)?.url ?? undefined),
        effectConfetti: confetti,
        effectConfettiColors: confetti ? (confettiTheme === "custom" ? customColors : (CONFETTI_THEMES.find(t => t.value === confettiTheme)?.colors.join(",") ?? "")) : undefined,
        effectConfettiMode: confettiMode,
        effectBannerDuration: bannerDuration,
      };
      setSavedState(newState);
      onSaved?.();
    },
    onError: (e) => toast.error(`Error: ${e.message}`),
  });

  const handleSave = () => {
    const colorsStr = confettiTheme === "custom"
      ? customColors
      : (CONFETTI_THEMES.find(t => t.value === confettiTheme)?.colors.join(",") ?? "");
    updateEffect.mutate({
      id: lessonId,
      effectEnabled: enabled,
      effectTrigger: trigger,
      effectBannerText: bannerText || undefined,
      effectBannerBgColor: bannerBg,
      effectBannerTextColor: bannerTextColor,
      effectSound: soundPreset !== "none" ? soundPreset : undefined,
      effectSoundUrl: soundPreset === "custom" ? customSoundUrl : (SOUND_PRESETS.find(p => p.value === soundPreset)?.url ?? undefined),
      effectConfetti: confetti,
      effectConfettiColors: confetti ? colorsStr : undefined,
      effectConfettiMode: confettiMode,
      effectBannerDuration: bannerDuration,
    });
  };

  const previewSound = () => {
    const url = soundPreset === "custom"
      ? customSoundUrl
      : SOUND_PRESETS.find(p => p.value === soundPreset)?.url ?? "";
    if (!url) return;
    const audio = new Audio(url);
    audio.volume = 0.6;
    audio.play().catch(() => toast.error("Could not play audio — check the URL."));
  };

  return (
    <div className="space-y-5 p-1">
      {/* Enable toggle */}
      <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
        <div>
          <p className="font-medium text-sm">Enable Lesson Effect</p>
          <p className="text-xs text-muted-foreground">Show banner, play sound, and/or fire confetti</p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {/* Active effect status badge */}
      {savedState?.effectEnabled && (
        <div className="flex items-center gap-2 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>
            Effect active: fires on <strong>{savedState.effectTrigger === "lesson_complete" ? "lesson complete" : "lesson start"}</strong>
            {savedState.effectBannerText ? ` · banner "${savedState.effectBannerText.slice(0, 40)}${savedState.effectBannerText.length > 40 ? "…" : ""}"` : ""}
            {savedState.effectSound && savedState.effectSound !== "none" ? ` · sound: ${savedState.effectSound}` : ""}
            {savedState.effectConfetti ? ` · confetti (${savedState.effectConfettiMode ?? "fall"}) 🎉` : ""}
          </span>
        </div>
      )}

      {enabled && (
        <>
          {/* Trigger */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trigger</Label>
            <Select value={trigger} onValueChange={(v) => setTrigger(v as "lesson_start" | "lesson_complete")}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lesson_start">On Lesson Start</SelectItem>
                <SelectItem value="lesson_complete">On Lesson Complete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Banner */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-teal-600" />
              <span className="text-sm font-semibold">Banner Message</span>
              <Badge variant="outline" className="text-xs">optional</Badge>
            </div>
            {/* Preset picker */}
            <Select
              value=""
              onValueChange={(v) => { if (v) setBannerText(v); }}
            >
              <SelectTrigger className="h-8 text-xs text-muted-foreground">
                <SelectValue placeholder="Choose a preset message…" />
              </SelectTrigger>
              <SelectContent>
                {BANNER_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset} className="text-xs">
                    {preset}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="e.g. Well done! You've started this lesson 🎉"
              value={bannerText}
              onChange={(e) => setBannerText(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Background Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bannerBg}
                    onChange={(e) => setBannerBg(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border"
                  />
                  <Input value={bannerBg} onChange={(e) => setBannerBg(e.target.value)} className="h-8 text-xs font-mono" />
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Text Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bannerTextColor}
                    onChange={(e) => setBannerTextColor(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border"
                  />
                  <Input value={bannerTextColor} onChange={(e) => setBannerTextColor(e.target.value)} className="h-8 text-xs font-mono" />
                </div>
              </div>
            </div>

            {/* Banner duration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-teal-600" />
                  <Label className="text-xs font-medium">Banner Display Duration</Label>
                </div>
                <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  {bannerDuration}s
                </span>
              </div>
              <Slider
                min={1}
                max={30}
                step={1}
                value={[bannerDuration]}
                onValueChange={([v]) => setBannerDuration(v)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1s</span>
                <span>15s</span>
                <span>30s</span>
              </div>
            </div>

            {/* Banner preview */}
            {bannerText && (
              <div
                className="rounded-lg px-4 py-3 text-sm font-medium text-center shadow"
                style={{ backgroundColor: bannerBg, color: bannerTextColor }}
              >
                {bannerText}
              </div>
            )}
          </div>

          <Separator />

          {/* Sound */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-teal-600" />
              <span className="text-sm font-semibold">Sound Effect</span>
            </div>
            <div className="flex gap-2">
              <Select value={soundPreset} onValueChange={setSoundPreset}>
                <SelectTrigger className="h-9 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOUND_PRESETS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {soundPreset !== "none" && (
                <Button size="sm" variant="outline" onClick={previewSound} className="h-9 gap-1">
                  <Play className="h-3 w-3" /> Preview
                </Button>
              )}
            </div>
            {soundPreset === "custom" && (
              <Input
                placeholder="https://example.com/sound.mp3"
                value={customSoundUrl}
                onChange={(e) => setCustomSoundUrl(e.target.value)}
                className="text-sm"
              />
            )}
          </div>

          <Separator />

          {/* Confetti */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-600" />
                <span className="text-sm font-semibold">Confetti</span>
              </div>
              <Switch checked={confetti} onCheckedChange={setConfetti} />
            </div>
            {confetti && (
              <div className="space-y-3">
                {/* Confetti Mode */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Confetti Style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfettiMode("fall")}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        confettiMode === "fall"
                          ? "border-teal-500 bg-teal-50 text-teal-700 font-medium"
                          : "border-border hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <Wind className="h-4 w-4 shrink-0" />
                      <div className="text-left">
                        <div className="font-medium text-xs">Fall</div>
                        <div className="text-[10px] opacity-70">Gentle rain from top</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfettiMode("cannon")}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        confettiMode === "cannon"
                          ? "border-teal-500 bg-teal-50 text-teal-700 font-medium"
                          : "border-border hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <Zap className="h-4 w-4 shrink-0" />
                      <div className="text-left">
                        <div className="font-medium text-xs">Cannon</div>
                        <div className="text-[10px] opacity-70">Burst from both sides</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Color Theme */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Color Theme</Label>
                  <Select value={confettiTheme} onValueChange={setConfettiTheme}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONFETTI_THEMES.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          <div className="flex items-center gap-2">
                            {t.value !== "custom" && (
                              <div className="flex gap-0.5">
                                {t.colors.slice(0,4).map(c => (
                                  <div key={c} className="h-3 w-3 rounded-full border border-white/30" style={{ backgroundColor: c }} />
                                ))}
                              </div>
                            )}
                            {t.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {confettiTheme === "custom" && (
                    <Input
                      placeholder="#ff0000,#00ff00,#0000ff (comma-separated hex)"
                      value={customColors}
                      onChange={(e) => setCustomColors(e.target.value)}
                      className="text-sm font-mono"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <Button onClick={handleSave} disabled={updateEffect.isPending} className="w-full gap-2 bg-teal-600 hover:bg-teal-700">
        <Save className="h-4 w-4" />
        {updateEffect.isPending ? "Saving…" : "Save Effect Settings"}
      </Button>
    </div>
  );
}
