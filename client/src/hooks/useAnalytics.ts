/**
 * useAnalytics — lightweight client-side analytics hook.
 * Wraps tRPC mutations for page views, video events, and quiz attempts.
 * All calls are fire-and-forget (errors are silently swallowed).
 */
import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

// Stable session ID for the current browser tab
function getSessionId(): string {
  let sid = sessionStorage.getItem("_asid");
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("_asid", sid);
  }
  return sid;
}

/** Automatically tracks page views on route change. Mount once in App.tsx. */
export function usePageViewTracker() {
  const [location] = useLocation();
  const pageViewMut = trpc.analyticsTrack.pageView.useMutation();
  const prevPath = useRef<string | null>(null);
  const enterTime = useRef<number>(Date.now());

  useEffect(() => {
    const now = Date.now();
    const sessionId = getSessionId();

    // Update duration of previous page before tracking new one
    if (prevPath.current && prevPath.current !== location) {
      const durationMs = now - enterTime.current;
      pageViewMut.mutate({
        path: location,
        referrer: prevPath.current,
        sessionId,
        durationMs,
      });
    } else if (!prevPath.current) {
      // First page load
      pageViewMut.mutate({
        path: location,
        sessionId,
      });
    }

    prevPath.current = location;
    enterTime.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);
}

/** Returns functions to track video events and quiz attempts from CoursePlayer. */
export function useLmsAnalytics(lessonId: number | undefined, courseId: number | undefined) {
  const videoEventMut = trpc.analyticsTrack.videoEvent.useMutation();
  const quizAttemptMut = trpc.analyticsTrack.quizAttempt.useMutation();

  const trackVideo = useCallback(
    (
      eventType: "play" | "pause" | "complete" | "seek" | "progress",
      positionSec: number,
      durationSec: number,
      percentWatched: number
    ) => {
      if (!lessonId || !courseId) return;
      videoEventMut.mutate({ lessonId, courseId, eventType, positionSec, durationSec, percentWatched });
    },
    [lessonId, courseId, videoEventMut]
  );

  const trackQuiz = useCallback(
    (opts: {
      score: number;
      passed: boolean;
      totalQuestions: number;
      correctAnswers: number;
      timeTakenSec?: number;
      answersJson?: string;
    }) => {
      if (!lessonId || !courseId) return;
      quizAttemptMut.mutate({ lessonId, courseId, ...opts });
    },
    [lessonId, courseId, quizAttemptMut]
  );

  return { trackVideo, trackQuiz };
}
