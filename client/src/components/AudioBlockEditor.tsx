/**
 * AudioBlockEditor.tsx
 * Block editor panel for the "audio" block type.
 *
 * Fixes applied:
 *  1. Recording: create an object URL immediately after stop so the preview
 *     works before the S3 upload completes.
 *  2. Duration detection: use the previewRef audio element directly (avoids
 *     creating a second Audio() that may be blocked by CORS). Falls back to
 *     multiple events (loadedmetadata, canplay, durationchange).
 *  3. Trim: trimEnd is initialised to full duration when a new file is loaded.
 *  4. Upload: passes the blob file directly; the server handles any mime type.
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { Mic, Square, Upload, Play, Pause, Scissors, X, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface AudioBlockEditorProps {
  d: Record<string, any>;
  set: (key: string, value: any) => void;
  handleFileUpload: (file: File, targetField: string, context: string) => void;
  uploading: string | null;
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
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

  // blobPreviewUrl: temporary object URL created immediately after recording stops,
  // so the user can preview/trim before the S3 upload finishes.
  const [blobPreviewUrl, setBlobPreviewUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const [duration, setDuration] = useState<number>(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const audioUrl: string = d.audioUrl ?? "";
  const trimStart: number = d.trimStart ?? 0;
  const trimEnd: number = d.trimEnd ?? 0;

  // The URL to use for the preview audio element — prefer the uploaded S3 URL,
  // fall back to the local blob URL while uploading.
  const activePreviewUrl = audioUrl || blobPreviewUrl || "";

  // ── Duration detection via the preview audio element ──────────────────────
  useEffect(() => {
    if (!activePreviewUrl) { setDuration(0); return; }

    const el = previewRef.current;
    if (!el) return;

    const applyDuration = () => {
      const dur = el.duration;
      if (isFinite(dur) && dur > 0) {
        setDuration(dur);
        // Auto-set trimEnd to full duration when a new file is loaded
        // (only if trimEnd is 0 or not yet set)
        if (!d.trimEnd || d.trimEnd === 0) {
          set("trimEnd", dur);
        }
      }
    };

    el.addEventListener("loadedmetadata", applyDuration);
    el.addEventListener("durationchange", applyDuration);
    el.addEventListener("canplay", applyDuration);

    // If already loaded (e.g. cached)
    if (el.readyState >= 1 && isFinite(el.duration) && el.duration > 0) {
      applyDuration();
    }

    return () => {
      el.removeEventListener("loadedmetadata", applyDuration);
      el.removeEventListener("durationchange", applyDuration);
      el.removeEventListener("canplay", applyDuration);
    };
  }, [activePreviewUrl]);

  // Revoke blob URL when the real S3 URL arrives
  useEffect(() => {
    if (audioUrl && blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setBlobPreviewUrl(null);
    }
  }, [audioUrl]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  // ── Recording ─────────────────────────────────────────────────────────────
  // Store the latest handleFileUpload in a ref so the onstop closure always
  // uses the current version (avoids stale closure issues).
  const handleFileUploadRef = useRef(handleFileUpload);
  handleFileUploadRef.current = handleFileUpload;
  const setRef = useRef(set);
  setRef.current = set;

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Verify we actually have an active audio track
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0 || !audioTracks[0].enabled) {
        toast.error("No active microphone track found. Please check your microphone.");
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg")
        ? "audio/ogg"
        : "";
      if (!mimeType) {
        toast.error("Your browser does not support audio recording. Please use Chrome or Firefox.");
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());

        if (chunksRef.current.length === 0) {
          toast.error("Recording produced no audio data. Please check your microphone.");
          setRecording(false);
          if (recTimerRef.current) clearInterval(recTimerRef.current);
          setRecSeconds(0);
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });

        if (blob.size < 100) {
          toast.error("Recording is too short or empty. Please try again.");
          setRecording(false);
          if (recTimerRef.current) clearInterval(recTimerRef.current);
          setRecSeconds(0);
          return;
        }

        // Create a local blob URL immediately so the user can preview/trim
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setBlobPreviewUrl(blobUrl);
        // Reset trim so it re-detects duration from the new blob
        setRef.current("trimStart", 0);
        setRef.current("trimEnd", 0);

        // Upload to S3 in the background
        // Use the correct file extension based on mime type
        const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: mimeType });
        handleFileUploadRef.current(file, "audioUrl", "audio-recording");

        setRecording(false);
        if (recTimerRef.current) clearInterval(recTimerRef.current);
        setRecSeconds(0);
      };

      // Do NOT pass a timeslice — let the browser collect all data in one chunk
      // on stop. Using timeslice (e.g. 250ms) can produce fragmented WebM clusters
      // that don't concatenate into a valid file in some browsers.
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch (err: any) {
      toast.error(err?.message?.includes("Permission")
        ? "Microphone access denied. Please allow microphone permissions."
        : "Could not start recording. Please check your microphone.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  // ── Preview playback ──────────────────────────────────────────────────────
  const togglePreview = () => {
    const el = previewRef.current;
    if (!el) return;
    if (previewPlaying) {
      el.pause();
      setPreviewPlaying(false);
    } else {
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
      if (end > 0 && el.currentTime >= end - 0.1) {
        el.pause();
        el.currentTime = d.trimStart ?? 0;
        setPreviewPlaying(false);
      }
    };
    const onEnded = () => setPreviewPlaying(false);
    el.addEventListener("timeupdate", check);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", check);
      el.removeEventListener("ended", onEnded);
    };
  }, [duration, d.trimStart, d.trimEnd]);

  const effectiveTrimEnd = (d.trimEnd && d.trimEnd > 0 && duration > 0)
    ? Math.min(d.trimEnd, duration)
    : duration;

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

      {/* ── Upload / Record ── */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Audio File</label>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm,.aac,.flac"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) {
                if (f.size > 100 * 1024 * 1024) { toast.error("Audio file must be under 100 MB"); return; }
                // Reset trim so duration re-detects for the new file
                set("trimStart", 0);
                set("trimEnd", 0);
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

        {/* Upload status indicator */}
        {uploading === "audioUrl" && blobPreviewUrl && (
          <p className="text-[10px] text-teal-600 mt-1 animate-pulse">⬆ Uploading to cloud… you can trim while waiting.</p>
        )}
      </div>

      {/* ── URL override ── */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Or paste audio URL</label>
        <div className="flex gap-1">
          <Input
            value={audioUrl}
            onChange={e => {
              set("audioUrl", e.target.value);
              set("trimStart", 0);
              set("trimEnd", 0);
            }}
            className="h-8 text-xs flex-1"
            placeholder="https://example.com/audio.mp3"
          />
          {audioUrl && (
            <button
              type="button"
              onClick={() => { set("audioUrl", ""); set("trimStart", 0); set("trimEnd", 0); setBlobPreviewUrl(null); }}
              className="text-gray-400 hover:text-red-500"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Hidden audio element for preview / duration detection ── */}
      {activePreviewUrl && (
        <audio
          key={activePreviewUrl}
          ref={previewRef}
          src={activePreviewUrl}
          preload="metadata"
          className="hidden"
        />
      )}

      {/* ── Trim controls ── */}
      {activePreviewUrl && duration > 0 && (
        <div className="border border-gray-100 rounded p-2 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <Scissors size={11} /> Trim Clip
            </p>
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
                className="flex items-center gap-1 px-2 py.5 text-xs text-gray-500 rounded border border-gray-200 hover:bg-gray-50"
              >
                <RotateCcw size={10} /> Reset
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Start: {fmt(trimStart)}</span>
              <span>End: {fmt(effectiveTrimEnd)}</span>
              <span>Clip: {fmt(Math.max(0, effectiveTrimEnd - trimStart))}</span>
            </div>

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

      {/* ── Caption / Styling ── */}
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
