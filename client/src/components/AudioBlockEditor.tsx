/**
 * AudioBlockEditor.tsx
 * Block editor panel for the "audio" block type.
 * Features:
 *  - Upload mp3/wav/ogg/m4a/webm audio files (via existing handleFileUpload)
 *  - In-browser microphone recording (MediaRecorder API)
 *  - Autoplay toggle (muted by default for browser policy)
 *  - Loop toggle
 *  - Show/hide native controls
 *  - Trim: set start and end time with a dual-thumb range slider
 *  - Title / caption fields
 *  - Background colour
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { Mic, Square, Upload, Play, Pause, Scissors, X, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AudioBlockEditorProps {
  d: Record<string, any>;
  set: (key: string, value: any) => void;
  handleFileUpload: (file: File, targetField: string, context: string) => void;
  uploading: string | null;
}

/** Format seconds → mm:ss */
function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function AudioBlockEditor({ d, set, handleFileUpload, uploading }: AudioBlockEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [duration, setDuration] = useState<number>(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const audioUrl: string = d.audioUrl ?? "";
  const trimStart: number = d.trimStart ?? 0;
  const trimEnd: number = d.trimEnd ?? 0; // 0 = use full duration

  // ── Load duration when URL changes ──────────────────────────────────────
  useEffect(() => {
    if (!audioUrl) { setDuration(0); return; }
    const a = new Audio(audioUrl);
    a.addEventListener("loadedmetadata", () => {
      setDuration(a.duration || 0);
      if (!d.trimEnd || d.trimEnd === 0) set("trimEnd", a.duration);
    });
    a.load();
  }, [audioUrl]);

  // ── Recording ────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: mr.mimeType });
        handleFileUpload(file, "audioUrl", "audio-recording");
        setRecording(false);
        if (recTimerRef.current) clearInterval(recTimerRef.current);
        setRecSeconds(0);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch {
      toast.error("Microphone access denied. Please allow microphone permissions.");
    }
  }, [handleFileUpload]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  // ── Preview playback ─────────────────────────────────────────────────────
  const togglePreview = () => {
    const el = previewRef.current;
    if (!el) return;
    if (previewPlaying) { el.pause(); setPreviewPlaying(false); }
    else {
      if (trimStart > 0) el.currentTime = trimStart;
      el.play().then(() => setPreviewPlaying(true)).catch(() => {});
    }
  };

  // Stop preview at trimEnd
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const check = () => {
      const end = d.trimEnd && d.trimEnd > 0 ? d.trimEnd : duration;
      if (end > 0 && el.currentTime >= end) { el.pause(); el.currentTime = d.trimStart ?? 0; setPreviewPlaying(false); }
    };
    el.addEventListener("timeupdate", check);
    el.addEventListener("ended", () => setPreviewPlaying(false));
    return () => { el.removeEventListener("timeupdate", check); };
  }, [duration, d.trimStart, d.trimEnd]);

  const effectiveTrimEnd = (d.trimEnd && d.trimEnd > 0 && duration > 0) ? d.trimEnd : duration;

  return (
    <div className="space-y-3">
      {/* ── Title ── */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Title (optional)</label>
        <Input
          value={d.title ?? ""}
          onChange={e => set("title", e.target.value)}
          className="h-8 text-sm"
          placeholder="e.g. Lecture Introduction"
        />
      </div>

      {/* ── Upload ── */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Audio File</label>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm,.aac,.flac"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) {
                if (f.size > 100 * 1024 * 1024) { toast.error("Audio file must be under 100 MB"); return; }
                handleFileUpload(f, "audioUrl", "audio-block");
              }
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading === "audioUrl" || recording}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100 disabled:opacity-50"
          >
            <Upload size={12} />
            {uploading === "audioUrl" ? "Uploading…" : "Upload Audio"}
          </button>
          {/* ── Record ── */}
          {!recording ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={uploading === "audioUrl"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100 disabled:opacity-50"
            >
              <Mic size={12} /> Record
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600 text-white rounded border border-red-700 hover:bg-red-700 animate-pulse"
            >
              <Square size={12} /> Stop ({fmt(recSeconds)})
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Supported: mp3, wav, ogg, m4a, webm, aac, flac · Max 100 MB</p>
      </div>

      {/* ── URL override ── */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Or paste audio URL</label>
        <div className="flex gap-1">
          <Input
            value={audioUrl}
            onChange={e => set("audioUrl", e.target.value)}
            className="h-8 text-xs flex-1"
            placeholder="https://example.com/audio.mp3"
          />
          {audioUrl && (
            <button type="button" onClick={() => { set("audioUrl", ""); set("trimStart", 0); set("trimEnd", 0); }} className="text-gray-400 hover:text-red-500">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Hidden audio for preview / duration detection ── */}
      {audioUrl && <audio ref={previewRef} src={audioUrl} preload="metadata" className="hidden" />}

      {/* ── Trim controls ── */}
      {audioUrl && duration > 0 && (
        <div className="border border-gray-100 rounded p-2 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1"><Scissors size={11} /> Trim Clip</p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={togglePreview}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100"
              >
                {previewPlaying ? <Pause size={10} /> : <Play size={10} />}
                {previewPlaying ? "Pause" : "Preview"}
              </button>
              <button
                type="button"
                onClick={() => { set("trimStart", 0); set("trimEnd", duration); }}
                className="flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500 rounded border border-gray-200 hover:bg-gray-50"
              >
                <RotateCcw size={10} /> Reset
              </button>
            </div>
          </div>

          {/* Dual range slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Start: {fmt(trimStart)}</span>
              <span>End: {fmt(effectiveTrimEnd)}</span>
              <span>Duration: {fmt(effectiveTrimEnd - trimStart)}</span>
            </div>

            {/* Start slider */}
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">Start time</label>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={trimStart}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if (v < effectiveTrimEnd - 0.5) set("trimStart", v);
                }}
                className="w-full accent-teal-600 h-1.5"
              />
            </div>

            {/* End slider */}
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">End time</label>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={effectiveTrimEnd}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if (v > trimStart + 0.5) set("trimEnd", v);
                }}
                className="w-full accent-teal-600 h-1.5"
              />
            </div>

            {/* Visual track */}
            <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="absolute h-full bg-teal-400 rounded-full"
                style={{
                  left: `${(trimStart / duration) * 100}%`,
                  width: `${((effectiveTrimEnd - trimStart) / duration) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Playback options ── */}
      <div className="border border-gray-100 rounded p-2 space-y-2">
        <p className="text-xs font-semibold text-gray-600 mb-1">Playback Options</p>
        {[
          { key: "autoplay", label: "Autoplay", note: "(muted required in most browsers)" },
          { key: "muted", label: "Muted" },
          { key: "loop", label: "Loop" },
          { key: "controls", label: "Show controls", defaultVal: true },
        ].map(({ key, label, note, defaultVal }) => (
          <div key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={d[key] ?? (defaultVal ?? false)}
              onChange={e => set(key, e.target.checked)}
              className="rounded"
            />
            <label className="text-xs text-gray-600">
              {label} {note && <span className="text-gray-400">{note}</span>}
            </label>
          </div>
        ))}
      </div>

      {/* ── Styling ── */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Caption / Description</label>
        <Input
          value={d.caption ?? ""}
          onChange={e => set("caption", e.target.value)}
          className="h-8 text-sm"
          placeholder="Optional caption shown below player"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Background Color</label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={d.bgColor ?? "#f8fffe"}
            onChange={e => set("bgColor", e.target.value)}
            className="h-8 w-10 rounded border border-gray-200 cursor-pointer"
          />
          <Input
            value={d.bgColor ?? "#f8fffe"}
            onChange={e => set("bgColor", e.target.value)}
            className="h-8 text-xs flex-1"
          />
        </div>
      </div>
    </div>
  );
}
