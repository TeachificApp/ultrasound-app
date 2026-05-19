/**
 * AudioBlockEditor.tsx
 * Block editor panel for the "audio" block type.
 *
 * Features:
 *  - Mic selection dialog before recording starts (lists all available audio inputs)
 *  - Explicit deviceId constraint so the correct mic is used
 *  - echoCancellation / noiseSuppression / autoGainControl enabled for cleaner audio
 *  - Object URL created immediately after stop for instant preview/trim before S3 upload
 *  - Duration detection via the preview audio element
 *  - Trim controls with dual-handle range sliders
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { Mic, Square, Upload, Play, Pause, Scissors, X, RotateCcw, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  // Mic selection dialog
  const [micDialogOpen, setMicDialogOpen] = useState(false);
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("default");

  // Audio level meter (AnalyserNode)
  const [audioLevel, setAudioLevel] = useState(0); // 0-100
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelRafRef = useRef<number | null>(null);

  const startLevelMeter = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
        setAudioLevel(Math.min(100, Math.round((rms / 128) * 100)));
        levelRafRef.current = requestAnimationFrame(tick);
      };
      // AudioContext starts suspended in many browsers — must resume before reading data
      if (ctx.state === "suspended") {
        ctx.resume().then(() => {
          levelRafRef.current = requestAnimationFrame(tick);
        }).catch(() => {
          levelRafRef.current = requestAnimationFrame(tick);
        });
      } else {
        levelRafRef.current = requestAnimationFrame(tick);
      }
    } catch { /* AudioContext not available */ }
  }, []);

  const stopLevelMeter = useCallback(() => {
    if (levelRafRef.current) { cancelAnimationFrame(levelRafRef.current); levelRafRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // blobPreviewUrl: temporary object URL created immediately after recording stops
  const [blobPreviewUrl, setBlobPreviewUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const [duration, setDuration] = useState<number>(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const audioUrl: string = d.audioUrl ?? "";
  const trimStart: number = d.trimStart ?? 0;
  const trimEnd: number = d.trimEnd ?? 0;

  // The URL to use for the preview audio element
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
        if (!d.trimEnd || d.trimEnd === 0) set("trimEnd", dur);
      }
    };
    el.addEventListener("loadedmetadata", applyDuration);
    el.addEventListener("durationchange", applyDuration);
    el.addEventListener("canplay", applyDuration);
    if (el.readyState >= 1 && isFinite(el.duration) && el.duration > 0) applyDuration();
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

  // Cleanup blob URL and permission stream on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      if (permStreamRef.current) { permStreamRef.current.getTracks().forEach(t => t.stop()); permStreamRef.current = null; }
    };
  }, []);

  // ── Recording ─────────────────────────────────────────────────────────────
  const handleFileUploadRef = useRef(handleFileUpload);
  handleFileUploadRef.current = handleFileUpload;
  const setRef = useRef(set);
  setRef.current = set;

  // Keep a reference to the permission stream so we can reuse it
  const permStreamRef = useRef<MediaStream | null>(null);

  /** Open mic selection dialog — enumerate devices first */
  const openMicDialog = useCallback(async () => {
    try {
      // Request permission to get device labels — keep stream alive so deviceId stays valid
      if (!permStreamRef.current || !permStreamRef.current.active) {
        permStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === "audioinput");
      setAvailableMics(mics);

      // Pre-select the device that the permission stream is already using
      const activeTrack = permStreamRef.current.getAudioTracks()[0];
      const activeDeviceId = activeTrack?.getSettings()?.deviceId;
      if (activeDeviceId) {
        setSelectedMicId(activeDeviceId);
      } else if (mics.length > 0) {
        setSelectedMicId(mics[0].deviceId);
      }

      setMicDialogOpen(true);
    } catch (err: any) {
      toast.error(err?.message?.includes("Permission")
        ? "Microphone access denied. Please allow microphone permissions in your browser."
        : "Could not access microphone. Please check your browser settings.");
    }
  }, []);

  /** Actually start recording with the chosen device */
  const startRecording = useCallback(async (deviceId: string) => {
    setMicDialogOpen(false);
    try {
      // Try to reuse the permission stream if the device matches — avoids re-requesting
      // getUserMedia with exact deviceId which can fail on some browsers
      let stream: MediaStream | null = null;
      const permStream = permStreamRef.current;
      if (permStream && permStream.active) {
        const permTrack = permStream.getAudioTracks()[0];
        const permDeviceId = permTrack?.getSettings()?.deviceId;
        if (!deviceId || deviceId === "default" || deviceId === permDeviceId) {
          // Reuse the existing stream
          stream = permStream;
          permStreamRef.current = null; // transfer ownership — onstop will stop it
        }
      }

      if (!stream) {
        // Need a new stream for a different device
        // Stop the permission stream first to release the old device
        if (permStreamRef.current) {
          permStreamRef.current.getTracks().forEach(t => t.stop());
          permStreamRef.current = null;
        }
        const constraints: MediaStreamConstraints = {
          audio: {
            deviceId: deviceId && deviceId !== "default" ? { exact: deviceId } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 1,
          },
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      }

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0 || !audioTracks[0].enabled) {
        toast.error("No active microphone track found. Please check your microphone.");
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      // Start level meter
      startLevelMeter(stream);

      // Log the actual device being used
      const trackSettings = audioTracks[0].getSettings();
      console.log("[AudioBlockEditor] Recording from:", audioTracks[0].label, "settings:", trackSettings);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg")
        ? "audio/ogg"
        : "";

      if (!mimeType) {
        toast.error("Your browser does not support audio recording. Please use Chrome or Firefox.");
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const mr = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        stopLevelMeter();

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

        // Create a local blob URL immediately for preview/trim
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setBlobPreviewUrl(blobUrl);
        setRef.current("trimStart", 0);
        setRef.current("trimEnd", 0);

        // Upload to S3
        const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: mimeType });
        handleFileUploadRef.current(file, "audioUrl", "audio-recording");

        setRecording(false);
        if (recTimerRef.current) clearInterval(recTimerRef.current);
        setRecSeconds(0);
      };

      // Use a 1-second timeslice so we get data even if the tab loses focus,
      // but the final onstop will still collect all chunks into one blob.
      mr.start(1000);
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch (err: any) {
      stopLevelMeter();
      const msg = err?.message ?? "";
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        toast.error("Microphone access denied. Please allow microphone permissions.");
      } else if (msg.includes("NotFound") || msg.includes("DevicesNotFound")) {
        toast.error("Selected microphone not found. Please choose a different device.");
        openMicDialog();
      } else {
        toast.error("Could not start recording: " + msg);
      }
    }
  }, [openMicDialog, startLevelMeter, stopLevelMeter]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    stopLevelMeter();
  }, [stopLevelMeter]);

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
      {/* ── Mic Selection Dialog ── */}
      <Dialog open={micDialogOpen} onOpenChange={setMicDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mic size={16} className="text-teal-600" /> Select Microphone
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-500">Choose the microphone to record from:</p>
            {availableMics.length === 0 ? (
              <p className="text-sm text-red-500">No microphones found. Please connect a microphone and try again.</p>
            ) : (
              <Select value={selectedMicId} onValueChange={setSelectedMicId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select microphone…" />
                </SelectTrigger>
                <SelectContent>
                  {availableMics.map((mic, i) => (
                    <SelectItem key={mic.deviceId} value={mic.deviceId}>
                      {mic.label || `Microphone ${i + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setMicDialogOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={availableMics.length === 0}
              onClick={() => startRecording(selectedMicId)}
            >
              <Mic size={14} className="mr-1" /> Start Recording
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              onClick={openMicDialog}
              disabled={uploading === "audioUrl"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100 disabled:opacity-50"
            >
              <Mic size={12} /> Record
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600 text-white rounded border border-red-700 hover:bg-red-700"
            >
              <Square size={12} /> Stop ({fmt(recSeconds)})
            </button>
          )}
        </div>

        {/* ── Live audio level meter ── */}
        {recording && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                REC {fmt(recSeconds)}
              </span>
              <span className="text-[10px] text-gray-400">
                {audioLevel === 0 ? "No signal" : audioLevel < 15 ? "Signal very low" : audioLevel < 50 ? "Signal OK" : "Signal strong"}
              </span>
            </div>
            {/* 20-segment bar meter */}
            <div className="flex gap-0.5 items-end h-5">
              {Array.from({ length: 20 }, (_, i) => {
                const threshold = (i + 1) * 5;
                const active = audioLevel >= threshold;
                const color = i < 12 ? "bg-teal-500" : i < 16 ? "bg-yellow-400" : "bg-red-500";
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm transition-all duration-75 ${active ? color : "bg-gray-200"}`}
                    style={{ height: `${40 + i * 3}%` }}
                  />
                );
              })}
            </div>
            {audioLevel === 0 && (
              <p className="text-[10px] text-amber-600">
                No audio detected — check that the correct microphone is selected and not muted.
              </p>
            )}
          </div>
        )}

        <p className="text-[10px] text-gray-400 mt-1">Supported: mp3, wav, ogg, m4a, webm, aac, flac · Max 100 MB</p>

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
                className="flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500 rounded border border-gray-200 hover:bg-gray-50"
              >
                <RotateCcw size={10} /> Reset
              </button>
            </div>
          </div>

          {/* Dual-handle trim bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Start: {fmt(trimStart)}</span>
              <span>End: {fmt(effectiveTrimEnd)}</span>
              <span>Duration: {fmt(effectiveTrimEnd - trimStart)}</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-8">Start</span>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={trimStart}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    if (v < effectiveTrimEnd) set("trimStart", v);
                  }}
                  className="flex-1 accent-teal-600"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-8">End</span>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={effectiveTrimEnd}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    if (v > trimStart) set("trimEnd", v);
                  }}
                  className="flex-1 accent-teal-600"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Playback Options ── */}
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

      {/* ── Transcript ── */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Transcript (optional)</label>
        <textarea
          value={d.transcript ?? ""}
          onChange={e => set("transcript", e.target.value)}
          className="w-full text-xs border border-gray-200 rounded p-2 min-h-[60px] resize-y focus:outline-none focus:ring-1 focus:ring-teal-400"
          placeholder="Add a text transcript for accessibility…"
        />
      </div>
    </div>
  );
}
