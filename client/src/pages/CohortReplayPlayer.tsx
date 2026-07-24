/**
 * CohortReplayPlayer.tsx
 * Individual recording player page for cohort replays.
 * Route: /cohort/:courseId/replay/:recordingId
 *
 * Features:
 * - Plyr.js video player with full CSS custom-property theming (course primaryColor)
 * - Smart video rendering (YouTube/Vimeo via Plyr embed, direct MP4/WebM, generic iframe)
 * - Video progress tracking (play, pause, progress milestones, complete)
 * - Breadcrumb navigation back to cohort replays tab
 */
import React, { useRef, useEffect, useCallback, useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, Film, Calendar, Clock, AlertCircle, BookOpen,
} from "lucide-react";
import { RichTextDisplay } from "@/components/RichTextEditor";
import Plyr from "plyr";
import "plyr/dist/plyr.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "TBD";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function fmtDuration(secs: number) {
  if (secs <= 0) return "";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Detect video URL type and return Plyr provider info */
type EmbedInfo =
  | { kind: "plyr-video"; src: string }
  | { kind: "plyr-youtube"; videoId: string }
  | { kind: "plyr-vimeo"; videoId: string }
  | { kind: "plyr-wistia"; videoId: string }
  | { kind: "iframe"; src: string };

function getEmbedInfo(url: string): EmbedInfo {
  if (!url) return { kind: "plyr-video", src: url };
  // YouTube
  const ytMatch = url.match(/(?:[?&]v=|youtu\.be\/|youtube\.com\/(?:shorts\/|embed\/))([-\w]+)/);
  if (ytMatch) return { kind: "plyr-youtube", videoId: ytMatch[1] };
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) return { kind: "plyr-vimeo", videoId: vimeoMatch[1] };
  // Wistia embed URL (fast.wistia.net/embed/iframe/XXXX)
  const wistiaMatch = url.match(/fast\.wistia\.(?:net|com)\/embed\/iframe\/([\w-]+)/);
  if (wistiaMatch) return { kind: "plyr-wistia", videoId: wistiaMatch[1] };
  // Direct video file
  if (/\.(mp4|webm|ogg|mov)([?#]|$)/i.test(url)) return { kind: "plyr-video", src: url };
  // Generic iframe fallback (can't use Plyr)
  return { kind: "iframe", src: url };
}

// ─── Plyr Video Component ─────────────────────────────────────────────────────

interface PlyrVideoProps {
  embed: EmbedInfo;
  primaryColor: string;
  accentColor: string;
  posterUrl?: string | null;
  showControls?: boolean;
  onReady?: (player: Plyr) => void;
}

function PlyrVideo({ embed, primaryColor, accentColor, posterUrl, showControls = true, onReady }: PlyrVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Plyr | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    let element: HTMLElement;

    if (embed.kind === "plyr-youtube") {
      const div = document.createElement("div");
      div.setAttribute("data-plyr-provider", "youtube");
      div.setAttribute("data-plyr-embed-id", embed.videoId);
      container.appendChild(div);
      element = div;
    } else if (embed.kind === "plyr-vimeo") {
      const div = document.createElement("div");
      div.setAttribute("data-plyr-provider", "vimeo");
      div.setAttribute("data-plyr-embed-id", embed.videoId);
      container.appendChild(div);
      element = div;
    } else if (embed.kind === "plyr-wistia") {
      const div = document.createElement("div");
      div.setAttribute("data-plyr-provider", "vimeo"); // Wistia uses iframe approach
      // Wistia doesn't have native Plyr support - use iframe fallback rendered below
      container.appendChild(div);
      element = div;
    } else {
      // plyr-video
      const video = document.createElement("video");
      video.src = (embed as any).src ?? "";
      video.setAttribute("playsinline", "");
      video.setAttribute("controls", "");
      video.setAttribute("preload", "metadata");
      if (posterUrl) video.setAttribute("poster", posterUrl);
      container.appendChild(video);
      element = video;
    }

    const player = new Plyr(element, {
      controls: showControls
        ? ["play-large", "play", "rewind", "fast-forward", "progress", "current-time", "duration", "mute", "volume", "captions", "settings", "pip", "fullscreen"]
        : [],
      settings: ["quality", "speed"],
      speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
      youtube: { noCookie: true, rel: 0, controls: showControls ? 1 : 0 },
      vimeo: { byline: false, portrait: false, title: false },
    });

    playerRef.current = player;
    if (onReady) player.on("ready", () => onReady(player));

    return () => {
      player.destroy();
      // Remove created element
      if (container.contains(element)) container.removeChild(element);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embed.kind, (embed as any).src ?? (embed as any).videoId]);

  // Build CSS vars for Plyr theming
  const cssVars = `
    .plyr {
      --plyr-color-main: ${primaryColor};
      --plyr-range-fill-background: ${primaryColor};
      --plyr-range-thumb-background: ${primaryColor};
      --plyr-video-control-color: #fff;
      --plyr-video-control-color-hover: #fff;
      --plyr-video-control-background-hover: ${primaryColor}cc;
      --plyr-control-icon-size: 18px;
      --plyr-control-spacing: 10px;
      --plyr-video-controls-background: linear-gradient(rgba(0,0,0,0), ${primaryColor}cc);
      --plyr-badge-background: ${primaryColor};
      --plyr-menu-background: rgba(20,20,20,0.92);
      --plyr-tooltip-background: rgba(20,20,20,0.92);
      --plyr-tooltip-color: #fff;
      --plyr-range-track-height: 4px;
      --plyr-range-thumb-height: 14px;
      --plyr-range-thumb-width: 14px;
      --plyr-font-size-base: 14px;
    }
    .plyr--full-ui input[type=range] {
      accent-color: ${primaryColor};
    }
    .plyr__progress__buffer {
      background: ${accentColor}55;
    }
    .plyr__volume input[type=range] {
      accent-color: ${primaryColor};
    }
    .plyr__control--overlaid {
      background: ${primaryColor}cc !important;
    }
    .plyr__control--overlaid:hover {
      background: ${primaryColor} !important;
    }
    .plyr__control.plyr__tab-focus,
    .plyr__control:hover,
    .plyr__control[aria-expanded=true] {
      background: ${primaryColor}cc;
    }
    .plyr--video .plyr__control.plyr__tab-focus,
    .plyr--video .plyr__control:hover,
    .plyr--video .plyr__control[aria-expanded=true] {
      background: ${primaryColor};
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <div ref={containerRef} className="w-full h-full" />
    </>
  );
}

// ─── Progress Tracker Hook ────────────────────────────────────────────────────

function usePlyrProgressTracker(
  playerRef: React.RefObject<Plyr | null>,
  opts: {
    recordingId: number;
    courseId: number;
    enabled: boolean;
    onTrack: (args: {
      recordingId: number;
      courseId: number;
      positionSec: number;
      durationSec: number;
      percentWatched: number;
      eventType: "play" | "pause" | "progress" | "complete";
    }) => void;
  }
) {
  const reportedMilestones = useRef(new Set<number>());

  const report = useCallback(
    (eventType: "play" | "pause" | "progress" | "complete") => {
      const player = playerRef.current;
      if (!player || !opts.enabled) return;
      const positionSec = Math.floor(player.currentTime ?? 0);
      const durationSec = Math.floor(player.duration ?? 0);
      const percentWatched = durationSec > 0 ? Math.min(100, Math.floor((positionSec / durationSec) * 100)) : 0;
      opts.onTrack({ recordingId: opts.recordingId, courseId: opts.courseId, positionSec, durationSec, percentWatched, eventType });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opts.recordingId, opts.courseId, opts.enabled, opts.onTrack]
  );

  const handleReady = useCallback((player: Plyr) => {
    (playerRef as React.MutableRefObject<Plyr | null>).current = player;

    player.on("play", () => report("play"));
    player.on("pause", () => report("pause"));
    player.on("ended", () => report("complete"));
    player.on("timeupdate", () => {
      const dur = player.duration ?? 0;
      if (dur <= 0) return;
      const pct = Math.floor(((player.currentTime ?? 0) / dur) * 100);
      for (const milestone of [25, 50, 75, 90]) {
        if (pct >= milestone && !reportedMilestones.current.has(milestone)) {
          reportedMilestones.current.add(milestone);
          report("progress");
          break;
        }
      }
    });
  }, [report, playerRef]);

  return { handleReady };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CohortReplayPlayer() {
  const { courseId: courseIdStr, recordingId: recordingIdStr } = useParams<{
    courseId: string;
    recordingId: string;
  }>();
  const courseId = parseInt(courseIdStr ?? "0", 10);
  const recordingId = parseInt(recordingIdStr ?? "0", 10);
  const { user, isLoading: authLoading } = useAuth();
  const plyrRef = useRef<Plyr | null>(null);

  const { data, isLoading, error } = trpc.lmsLearner.getCohortRecording.useQuery(
    { courseId, recordingId },
    { enabled: !!user && courseId > 0 && recordingId > 0 }
  );

  const trackProgress = trpc.lmsLearner.trackCohortRecordingProgress.useMutation();

  const handleTrack = useCallback(
    (args: Parameters<typeof trackProgress.mutate>[0]) => {
      trackProgress.mutate(args);
    },
    [trackProgress]
  );

  const { handleReady } = usePlyrProgressTracker(plyrRef, {
    recordingId,
    courseId,
    enabled: !!user && !!data?.recording,
    onTrack: handleTrack,
  });

  // ── Loading / Auth / Error states ──────────────────────────────────────────

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading recording…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <BookOpen className="w-12 h-12 text-teal-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign in to watch</h2>
          <p className="text-gray-500 mb-6">You need to be signed in and enrolled to watch this recording.</p>
          <Button asChild className="bg-teal-600 hover:bg-teal-700">
            <a href={getLoginUrl()}>Sign In</a>
          </Button>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Recording not found</h2>
          <p className="text-gray-500 mb-6">
            {error?.message ?? "This recording could not be found or you do not have access."}
          </p>
          <Button asChild variant="outline">
            <Link href={`/cohort/${courseId}?tab=replays`}>Back to Replays</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const { recording, session, progress } = data;
  // Theme colors from course
  const primaryColor = (data as any).primaryColor as string ?? "#179ca3";
  const accentColor = (data as any).accentColor as string ?? "#0d9488";

  // Resolve embed info
  const resolvedEmbedUrl = (recording as any).resolvedEmbedUrl as string | null;
  const rawUrl = resolvedEmbedUrl ?? recording.videoUrl ?? "";
  const embed = rawUrl ? getEmbedInfo(rawUrl) : null;
  const hasCustomEmbed = !!(recording as any).embedCode;
  const durationSecs = recording.durationSeconds ?? 0;
  const showControls = recording.showControls ?? true;

  // Wistia videos: use iframe directly (Plyr doesn't support Wistia natively)
  const isWistia = embed?.kind === "plyr-wistia";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header / Breadcrumb ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" style={{ color: primaryColor }} asChild>
            <Link href={`/cohort/${courseId}?tab=replays`}>
              <ChevronLeft className="w-4 h-4" />
              Back to Replays
            </Link>
          </Button>
          <span className="text-gray-300 text-sm">/</span>
          <span className="text-sm text-gray-500 truncate max-w-[200px] sm:max-w-none">{recording.title}</span>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Video Player */}
        <div
          className="bg-black rounded-xl overflow-hidden"
          style={{ boxShadow: `0 4px 32px ${primaryColor}44` }}
        >
          {hasCustomEmbed ? (
            <div
              className="w-full aspect-video"
              dangerouslySetInnerHTML={{ __html: (recording as any).embedCode! }}
            />
          ) : embed && !isWistia ? (
            <div className="w-full aspect-video">
              <PlyrVideo
                embed={embed}
                primaryColor={primaryColor}
                accentColor={accentColor}
                posterUrl={recording.thumbnailUrl}
                showControls={showControls}
                onReady={handleReady}
              />
            </div>
          ) : embed && isWistia ? (
            // Wistia: use their native iframe embed (Plyr doesn't support Wistia)
            <div className="w-full aspect-video">
              <iframe
                src={showControls ? rawUrl : `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}controls=false`}
                className="w-full h-full"
                allowFullScreen
                allow="autoplay; fullscreen"
                title={recording.title}
                style={{ border: "none" }}
              />
            </div>
          ) : (
            <div className="w-full aspect-video flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <Film className="w-16 h-16 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No video available for this recording</p>
              </div>
            </div>
          )}
        </div>

        {/* Recording Info */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{recording.title}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <Badge
                  className="text-xs"
                  style={{ backgroundColor: `${primaryColor}22`, color: primaryColor, borderColor: `${primaryColor}44` }}
                >
                  Recording
                </Badge>
                {durationSecs > 0 && (
                  <span className="flex items-center gap-1 text-sm text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    {fmtDuration(durationSecs)}
                  </span>
                )}
                {session?.sessionDate && (
                  <span className="flex items-center gap-1 text-sm text-gray-500">
                    <Calendar className="w-3.5 h-3.5" />
                    {fmtDate(session.sessionDate)}
                  </span>
                )}
              </div>
            </div>
            {/* Progress indicator */}
            {progress && progress.percentWatched > 0 && (
              <div className="flex-shrink-0 text-right">
                <div className="text-xs text-gray-400 mb-1">
                  {progress.completed ? "Completed" : `${progress.percentWatched}% watched`}
                </div>
                <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${progress.percentWatched}%`,
                      backgroundColor: progress.completed ? "#22c55e" : primaryColor,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {recording.description && (
            <Card className="border-gray-200">
              <CardContent className="p-4">
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{recording.description}</p>
              </CardContent>
            </Card>
          )}

          {session && (
            <Card className="border-gray-200" style={{ backgroundColor: `${primaryColor}0d` }}>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-2" style={{ color: primaryColor }}>Session Details</h3>
                <div className="space-y-1">
                  {session.title && <p className="text-sm text-gray-700 font-medium">{session.title}</p>}
                  {session.sessionDate && (
                    <p className="text-sm text-gray-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                      {fmtDate(session.sessionDate)}
                    </p>
                  )}
                  {session.description && (
                    <RichTextDisplay content={session.description} className="text-sm text-gray-600 mt-2" />
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
