/**
 * LessonEffectEditor — Admin panel for configuring per-lesson effects:
 * banner message, sound effect, and confetti cannon.
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Sparkles, Volume2, Megaphone, Save, Play } from "lucide-react";

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
  };
  onSaved?: () => void;
}

export default function LessonEffectEditor({ lessonId, initialData, onSaved }: LessonEffectEditorProps) {
  const [enabled, setEnabled] = useState(initialData?.effectEnabled ?? false);
  const [trigger, setTrigger] = useState<"lesson_start" | "lesson_complete">(
    (initialData?.effectTrigger as "lesson_start" | "lesson_complete") ?? "lesson_start"
  );
  const [bannerText, setBannerText] = useState(initialData?.effectBannerText ?? "");
  const [bannerBg, setBannerBg] = useState(initialData?.effectBannerBgColor ?? "#179ca3");
  const [bannerTextColor, setBannerTextColor] = useState(initialData?.effectBannerTextColor ?? "#ffffff");
  const [soundPreset, setSoundPreset] = useState(initialData?.effectSound ?? "none");
  const [customSoundUrl, setCustomSoundUrl] = useState(initialData?.effectSoundUrl ?? "");
  const [confetti, setConfetti] = useState(initialData?.effectConfetti ?? false);
  const [confettiTheme, setConfettiTheme] = useState("rainbow");
  const [customColors, setCustomColors] = useState(initialData?.effectConfettiColors ?? "");

  // Sync confetti theme from saved colors
  useEffect(() => {
    if (initialData?.effectConfettiColors) {
      const saved = initialData.effectConfettiColors;
      const match = CONFETTI_THEMES.find(t => t.colors.join(",") === saved);
      if (match) setConfettiTheme(match.value);
      else { setConfettiTheme("custom"); setCustomColors(saved); }
    }
  }, []);

  const updateEffect = trpc.lmsAdmin.updateLessonEffect.useMutation({
    onSuccess: () => {
      toast.success("Effect saved — lesson effect settings updated.");
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
    });
  };

  const previewSound = () => {
    const url = soundPreset === "custom"
      ? customSoundUrl
      : SOUND_PRESETS.find(p => p.value === soundPreset)?.url ?? "";
    if (!url) return;
    const audio = new Audio(url);
    audio.volume = 0.6;
    audio.play().catch(() => {});
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
                <span className="text-sm font-semibold">Confetti Cannon</span>
              </div>
              <Switch checked={confetti} onCheckedChange={setConfetti} />
            </div>
            {confetti && (
              <div className="space-y-2">
                <Label className="text-xs">Color Theme</Label>
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
