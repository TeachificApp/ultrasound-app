/**
 * TeachMediaFormatPanel — Office-style picture/video format controls.
 */

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  type TeachMediaFormat,
  type TeachFrameStyle,
  normalizeMediaFormat,
  applyFramePreset,
  FRAME_PRESETS,
  DEFAULT_VIDEO,
} from "@shared/teachPresentation";
import type { TeachSlideElement } from "@shared/teachPresentation";
import { RotateCcw } from "lucide-react";

interface TeachMediaFormatPanelProps {
  element: TeachSlideElement;
  onUpdate: (patch: Partial<TeachSlideElement>) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border-t pt-3 first:border-t-0 first:pt-0">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

function CorrectionSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-400 tabular-nums">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onChange(v ?? 0)}
        className="py-1"
      />
    </div>
  );
}

export function TeachMediaFormatPanel({ element, onUpdate }: TeachMediaFormatPanelProps) {
  const fmt = normalizeMediaFormat(element.mediaFormat);
  const isVideo = element.type === "video";

  const setFormat = (patch: Partial<TeachMediaFormat>) => {
    onUpdate({ mediaFormat: normalizeMediaFormat({ ...fmt, ...patch }) });
  };

  const setCorrections = (key: keyof TeachMediaFormat["corrections"], value: number) => {
    setFormat({ corrections: { ...fmt.corrections, [key]: value } });
  };

  const setColor = (key: keyof TeachMediaFormat["color"], value: number) => {
    setFormat({ color: { ...fmt.color, [key]: value } });
  };

  const setFrame = (key: keyof TeachMediaFormat["frame"], value: string | number) => {
    setFormat({ frame: { ...fmt.frame, [key]: value } });
  };

  const setShadow = (key: keyof TeachMediaFormat["shadow"], value: boolean | string | number) => {
    setFormat({ shadow: { ...fmt.shadow, [key]: value } });
  };

  const applyPreset = (style: TeachFrameStyle) => {
    const preset = applyFramePreset(style);
    onUpdate({ mediaFormat: preset });
  };

  const resetFormat = () => onUpdate({ mediaFormat: normalizeMediaFormat(undefined) });

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-teal-700 capitalize">{element.type} format</p>
        <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={resetFormat}>
          <RotateCcw className="w-3 h-3 mr-1" /> Reset
        </Button>
      </div>

      <Section title="Corrections">
        <CorrectionSlider label="Brightness" value={fmt.corrections.brightness} min={-100} max={100} onChange={(v) => setCorrections("brightness", v)} />
        <CorrectionSlider label="Contrast" value={fmt.corrections.contrast} min={-100} max={100} onChange={(v) => setCorrections("contrast", v)} />
        <CorrectionSlider label="Saturation" value={fmt.corrections.saturation} min={-100} max={100} onChange={(v) => setCorrections("saturation", v)} />
        <CorrectionSlider label="Sharpness" value={fmt.corrections.sharpness} min={0} max={100} onChange={(v) => setCorrections("sharpness", v)} />
      </Section>

      <Section title="Color">
        <CorrectionSlider label="Transparency" value={100 - fmt.color.opacity} min={0} max={100} onChange={(v) => setColor("opacity", 100 - v)} />
        <CorrectionSlider label="Grayscale" value={fmt.color.grayscale} min={0} max={100} onChange={(v) => setColor("grayscale", v)} />
        <CorrectionSlider label="Sepia" value={fmt.color.sepia} min={0} max={100} onChange={(v) => setColor("sepia", v)} />
        <CorrectionSlider label="Temperature" value={fmt.color.temperature} min={-100} max={100} onChange={(v) => setColor("temperature", v)} />
        <CorrectionSlider label="Tint" value={fmt.color.tint} min={-100} max={100} onChange={(v) => setColor("tint", v)} />
      </Section>

      <Section title="Picture styles">
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(FRAME_PRESETS) as TeachFrameStyle[]).map((key) => (
            <button
              key={key}
              type="button"
              title={FRAME_PRESETS[key].label}
              onClick={() => applyPreset(key)}
              className={`aspect-square rounded border text-[9px] flex items-center justify-center p-0.5 leading-tight text-center ${
                fmt.frame.style === key ? "border-teal-500 bg-teal-50 text-teal-800" : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              {FRAME_PRESETS[key].label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Frame">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Border width</Label>
            <Input type="number" min={0} max={24} className="h-7 text-xs mt-0.5" value={fmt.frame.borderWidth} onChange={(e) => setFrame("borderWidth", +e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Corner radius</Label>
            <Input type="number" min={0} max={48} className="h-7 text-xs mt-0.5" value={fmt.frame.borderRadius} onChange={(e) => setFrame("borderRadius", +e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Padding</Label>
            <Input type="number" min={0} max={32} className="h-7 text-xs mt-0.5" value={fmt.frame.padding} onChange={(e) => setFrame("padding", +e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Border color</Label>
            <input type="color" className="h-7 w-full rounded border mt-0.5" value={fmt.frame.borderColor} onChange={(e) => setFrame("borderColor", e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Mat / frame background</Label>
          <input type="color" className="h-7 w-full rounded border mt-0.5" value={fmt.frame.backgroundColor === "transparent" ? "#ffffff" : fmt.frame.backgroundColor ?? "#ffffff"} onChange={(e) => setFrame("backgroundColor", e.target.value)} />
        </div>
      </Section>

      <Section title="Shadow">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={fmt.shadow.enabled} onChange={(e) => setShadow("enabled", e.target.checked)} />
          Enable shadow
        </label>
        {fmt.shadow.enabled && (
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Offset X</Label><Input type="number" className="h-7 text-xs" value={fmt.shadow.offsetX} onChange={(e) => setShadow("offsetX", +e.target.value)} /></div>
            <div><Label className="text-xs">Offset Y</Label><Input type="number" className="h-7 text-xs" value={fmt.shadow.offsetY} onChange={(e) => setShadow("offsetY", +e.target.value)} /></div>
            <div><Label className="text-xs">Blur</Label><Input type="number" min={0} className="h-7 text-xs" value={fmt.shadow.blur} onChange={(e) => setShadow("blur", +e.target.value)} /></div>
            <div><Label className="text-xs">Spread</Label><Input type="number" className="h-7 text-xs" value={fmt.shadow.spread} onChange={(e) => setShadow("spread", +e.target.value)} /></div>
            <div className="col-span-2">
              <Label className="text-xs">Shadow color</Label>
              <Input type="text" className="h-7 text-xs mt-0.5" value={fmt.shadow.color} onChange={(e) => setShadow("color", e.target.value)} placeholder="rgba(0,0,0,0.35)" />
            </div>
          </div>
        )}
      </Section>

      <Section title="Crop &amp; fit">
        <Select value={fmt.objectFit} onValueChange={(v) => setFormat({ objectFit: v as TeachMediaFormat["objectFit"] })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="contain">Fit inside (contain)</SelectItem>
            <SelectItem value="cover">Fill frame (cover)</SelectItem>
            <SelectItem value="fill">Stretch (fill)</SelectItem>
          </SelectContent>
        </Select>
      </Section>

      {isVideo && (
        <Section title="Video playback">
          {(["autoplay", "loop", "muted", "controls"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-xs capitalize">
              <input
                type="checkbox"
                checked={element.video?.[k] ?? DEFAULT_VIDEO[k]}
                onChange={(e) => onUpdate({ video: { ...DEFAULT_VIDEO, ...element.video, [k]: e.target.checked } })}
              />
              {k}
            </label>
          ))}
          <div>
            <Label className="text-xs">Start at (sec)</Label>
            <Input
              type="number"
              min={0}
              className="h-7 text-xs mt-0.5"
              value={element.video?.startAtSec ?? ""}
              onChange={(e) =>
                onUpdate({
                  video: {
                    ...DEFAULT_VIDEO,
                    ...element.video,
                    startAtSec: e.target.value ? +e.target.value : undefined,
                  },
                })
              }
            />
          </div>
        </Section>
      )}
    </div>
  );
}
