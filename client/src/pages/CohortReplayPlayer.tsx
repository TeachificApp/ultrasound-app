/**
 * CohortReplayPlayer.tsx
 * Individual recording player page for cohort replays.
 * Route: /cohort/:courseId/replay/:recordingId
 *
 * Features:
 * - Smart video rendering (YouTube/Vimeo iframe, direct MP4/WebM video tag, generic iframe)
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
  ChevronLeft, Film, Calendar, Clock, AlertCircle, BookOpen, PlayCircle,
} from "lucide-react";

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

/** Detect video URL type and return embed info */
function getVideoEmbed(url: string): { type: "iframe" | "video"; src: string } {
  if (!url) return { type: "video", src: url };
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w.-]+)/);
  if (ytMatch) return { type: "iframe", src: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&enablejsapi=1` };
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) return { type: "iframe", src: `https://player.vimeo.com/video/${vimeoMatch[1]}?api=1` };
  // Direct video file
  if (/\.(mp4|webm|ogg|mov)([?#]|$)/i.test(url)) return { type: "video", src: url };
  // Generic iframe fallback
  return { type: "iframe", src: url };
}

// ─── Progress Tracker Hook ────────────────────────────────────────────────────

/**
 * Attaches to a <video> element and reports progress milestones (25/50/75/90%)
 * plus play, pause, and ended events via the trackCohortRecordingProgress mutation.
 */
function useVideoProgressTracker(
  videoRef: React.RefObject<HTMLVideoElement | null>,
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
      const vid = videoRef.current;
      if (!vid || !opts.enabled) return;
      const positionSec = Math.floor(vid.currentTime);
      const durationSec = Math.floor(vid.duration || 0);
      const percentWatched = durationSec > 0 ? Math.min(100, Math.floor((positionSec / durationSec) * 100)) : 0;
      opts.onTrack({ recordingId: opts.recordingId, courseId: opts.courseId, positionSec, durationSec, percentWatched, eventType });
    },
    [opts, videoRef]
  );

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !opts.enabled) return;

    const onPlay = () => report("play");
    const onPause = () => report("pause");
    const onEnded = () => report("complete");
    const onTimeUpdate = () => {
      const dur = vid.duration || 0;
      if (dur <= 0) return;
      const pct = Math.floor((vid.currentTime / dur) * 100);
      for (const milestone of [25, 50, 75, 90]) {
        if (pct >= milestone && !reportedMilestones.current.has(milestone)) {
          reportedMilestones.current.add(milestone);
          report("progress");
          break;
        }
      }
    };

    vid.addEventListener("play", onPlay);
    vid.addEventListener("pause", onPause);
    vid.addEventListener("ended", onEnded);
    vid.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      vid.removeEventListener("play", onPlay);
      vid.removeEventListener("pause", onPause);
      vid.removeEventListener("ended", onEnded);
      vid.removeEventListener("timeupdate", onTimeUpdate);
      // Report final position on unmount
      report("pause");
    };
  }, [videoRef, opts.enabled, report]);
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
  const videoRef = useRef<HTMLVideoElement>(null);

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

  useVideoProgressTracker(videoRef, {
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
  const embed = recording.videoUrl ? getVideoEmbed(recording.videoUrl) : null;
  const hasEmbed = !!recording.embedCode;
  const durationSecs = recording.durationSeconds ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header / Breadcrumb ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5 text-gray-600 hover:text-teal-700 -ml-2" asChild>
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
        <div className="bg-black rounded-xl overflow-hidden shadow-lg">
          {hasEmbed ? (
            <div
              className="w-full aspect-video"
              dangerouslySetInnerHTML={{ __html: recording.embedCode! }}
            />
          ) : embed ? (
            <div className="w-full aspect-video">
              {embed.type === "iframe" ? (
                <iframe
                  src={embed.src}
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  title={recording.title}
                  style={{ border: "none" }}
                />
              ) : (
                <video
                  ref={videoRef}
                  src={embed.src}
                  controls
                  className="w-full h-full"
                  preload="metadata"
                  poster={recording.thumbnailUrl ?? undefined}
                />
              )}
            </div>
          ) : recording.externalUrl ? (
            <div className="w-full aspect-video flex items-center justify-center bg-gradient-to-br from-teal-900 to-teal-800">
              <div className="text-center">
                <Film className="w-16 h-16 text-teal-300 mx-auto mb-4" />
                <p className="text-white font-medium mb-4">{recording.title}</p>
                <Button asChild className="bg-teal-500 hover:bg-teal-400 text-white">
                  <a href={recording.externalUrl} target="_blank" rel="noopener noreferrer">
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Watch Recording
                  </a>
                </Button>
              </div>
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
                <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-xs">Recording</Badge>
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
                    className={`h-full rounded-full transition-all ${progress.completed ? "bg-green-500" : "bg-teal-500"}`}
                    style={{ width: `${progress.percentWatched}%` }}
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
            <Card className="border-gray-200 bg-teal-50/50">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-teal-800 mb-2">Session Details</h3>
                <div className="space-y-1">
                  {session.title && <p className="text-sm text-gray-700 font-medium">{session.title}</p>}
                  {session.sessionDate && (
                    <p className="text-sm text-gray-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-teal-500" />
                      {fmtDate(session.sessionDate)}
                    </p>
                  )}
                  {session.description && (
                    <p className="text-sm text-gray-600 mt-2">{session.description}</p>
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
