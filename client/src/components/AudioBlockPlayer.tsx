/**
 * AudioBlockPlayer.tsx
 * Public-facing audio player for the "audio" block type.
 * Features:
 *  - Web Audio API waveform visualizer (canvas, decoded on load)
 *  - Scrub-position indicator that moves with playback
 *  - Trim start/end support
 *  - Autoplay, muted, loop, controls toggles
 */
import { useRef, useEffect, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Music } from "lucide-react";

interface AudioBlockPlayerProps {
  audioUrl: string;
  title?: string;
  caption?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  trimStart?: number;
  trimEnd?: number;
  bgColor?: string;
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── Waveform canvas ────────────────────────────────────────────────────────────
interface WaveformProps {
  peaks: Float32Array | null;
  progress: number; // 0-1
  trimStart: number;
  trimEnd: number;
  duration: number;
  onSeek: (ratio: number) => void;
  accentColor?: string;
}

function WaveformCanvas({
  peaks,
  progress,
  onSeek,
  accentColor = "#0d9488",
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw waveform whenever peaks or progress changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (!peaks || peaks.length === 0) {
      // Placeholder flat line
      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
      return;
    }

    const barW = Math.max(1, W / peaks.length);
    const midY = H / 2;
    const playedX = progress * W;

    for (let i = 0; i < peaks.length; i++) {
      const x = i * barW;
      const amp = Math.max(0.02, peaks[i]);
      const barH = amp * (H * 0.85);

      const isPlayed = x <= playedX;
      ctx.fillStyle = isPlayed ? accentColor : "#d1d5db";
      ctx.fillRect(x, midY - barH / 2, Math.max(1, barW - 1), barH);
    }

    // Scrub head
    ctx.fillStyle = accentColor;
    ctx.fillRect(playedX - 1, 0, 2, H);
  }, [peaks, progress, accentColor]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      onSeek(Math.max(0, Math.min(1, ratio)));
    },
    [onSeek]
  );

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={56}
      onClick={handleClick}
      className="w-full h-14 cursor-pointer rounded"
      aria-label="Audio waveform — click to seek"
    />
  );
}

// ── Decode waveform peaks from audio URL via Web Audio API ────────────────────
async function decodePeaks(url: string, numBars = 150): Promise<Float32Array> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return new Float32Array(0);

  const audioCtx = new AudioCtx();
  try {
    const response = await fetch(url, { mode: "cors" });
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / numBars);
    const peaks = new Float32Array(numBars);

    for (let i = 0; i < numBars; i++) {
      let max = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize; j++) {
        const abs = Math.abs(channelData[start + j]);
        if (abs > max) max = abs;
      }
      peaks[i] = max;
    }

    // Normalise
    const globalMax = Math.max(...Array.from(peaks));
    if (globalMax > 0) {
      for (let i = 0; i < peaks.length; i++) peaks[i] /= globalMax;
    }

    return peaks;
  } finally {
    audioCtx.close();
  }
}

// ── Main player ───────────────────────────────────────────────────────────────
export default function AudioBlockPlayer({
  audioUrl,
  title,
  caption,
  autoplay = false,
  muted: initMuted = false,
  loop = false,
  controls = true,
  trimStart = 0,
  trimEnd = 0,
  bgColor = "#f8fffe",
}: AudioBlockPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(initMuted || autoplay);
  const [currentTime, setCurrentTime] = useState(trimStart);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [waveError, setWaveError] = useState(false);

  const effectiveEnd = trimEnd > 0 ? trimEnd : duration;
  const progress =
    effectiveEnd > trimStart
      ? (currentTime - trimStart) / (effectiveEnd - trimStart)
      : 0;

  // Decode waveform peaks when URL changes
  useEffect(() => {
    if (!audioUrl) return;
    setPeaks(null);
    setWaveError(false);
    decodePeaks(audioUrl)
      .then(setPeaks)
      .catch(() => setWaveError(true));
  }, [audioUrl]);

  // Audio element event wiring
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = muted;
    el.loop = loop;

    const onMeta = () => {
      setDuration(el.duration);
      el.currentTime = trimStart;
      if (autoplay) el.play().catch(() => {});
    };
    const onTime = () => {
      setCurrentTime(el.currentTime);
      const end = trimEnd > 0 ? trimEnd : el.duration;
      if (end > 0 && el.currentTime >= end) {
        if (loop) {
          el.currentTime = trimStart;
          el.play().catch(() => {});
        } else {
          el.pause();
          el.currentTime = trimStart;
          setPlaying(false);
        }
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [audioUrl, trimStart, trimEnd, autoplay, loop]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      if (
        el.currentTime < trimStart ||
        (effectiveEnd > 0 && el.currentTime >= effectiveEnd)
      ) {
        el.currentTime = trimStart;
      }
      el.play().catch(() => {});
    }
  };

  const toggleMute = () => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = !muted;
    setMuted(!muted);
  };

  const seekByRatio = useCallback(
    (ratio: number) => {
      const el = audioRef.current;
      if (!el) return;
      const t = trimStart + ratio * (effectiveEnd - trimStart);
      el.currentTime = t;
      setCurrentTime(t);
    },
    [trimStart, effectiveEnd]
  );

  if (!controls) {
    return (
      <audio
        ref={audioRef}
        src={audioUrl}
        autoPlay={autoplay}
        muted={muted}
        loop={loop}
        preload="metadata"
        className="hidden"
      />
    );
  }

  return (
    <div className="px-8 py-6">
      <div
        className="mx-auto max-w-2xl rounded-xl p-4 shadow-sm border border-gray-100"
        style={{ backgroundColor: bgColor }}
      >
        {title && (
          <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Music size={14} className="text-teal-600 flex-shrink-0" />
            {title}
          </p>
        )}

        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          muted={muted}
          loop={loop}
          className="hidden"
        />

        {/* Waveform */}
        {!waveError && (
          <div className="mb-3 relative">
            {!peaks ? (
              // Loading skeleton
              <div className="w-full h-14 bg-gray-100 rounded animate-pulse flex items-center justify-center">
                <span className="text-[10px] text-gray-400">Loading waveform…</span>
              </div>
            ) : (
              <WaveformCanvas
                peaks={peaks}
                progress={progress}
                trimStart={trimStart}
                trimEnd={trimEnd}
                duration={duration}
                onSeek={seekByRatio}
                accentColor="#0d9488"
              />
            )}
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 flex-shrink-0 shadow transition-colors"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>

          {/* Time display + fallback scrubber (shown when waveform failed or loading) */}
          <div className="flex-1 space-y-1">
            {waveError && (
              <input
                type="range"
                min={trimStart}
                max={effectiveEnd || duration || 100}
                step={0.1}
                value={currentTime}
                onChange={(e) => {
                  const el = audioRef.current;
                  const t = parseFloat(e.target.value);
                  if (el) el.currentTime = t;
                  setCurrentTime(t);
                }}
                className="w-full accent-teal-600 h-1.5"
              />
            )}
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>{fmt(Math.max(0, currentTime - trimStart))}</span>
              <span>{fmt(Math.max(0, effectiveEnd - trimStart))}</span>
            </div>
          </div>

          {/* Mute */}
          <button
            type="button"
            onClick={toggleMute}
            className="text-gray-500 hover:text-teal-600 flex-shrink-0 transition-colors"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>

        {caption && <p className="text-xs text-gray-500 mt-2">{caption}</p>}
      </div>
    </div>
  );
}
