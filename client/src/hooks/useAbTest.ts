/**
 * useAbTest — deterministic A/B variant assignment + event tracking
 *
 * Variant assignment:
 *   - A stable sessionId is stored in localStorage (created once per browser).
 *   - The variant is derived deterministically from the sessionId using a simple
 *     hash, so the same user always sees the same variant.
 *   - For authenticated users, the userId is also mixed into the hash for
 *     additional stability across devices (optional enhancement).
 *
 * Tracking:
 *   - trackImpression() — call when the modal/element is shown
 *   - trackClick()      — call when the CTA is clicked
 *   - Both are fire-and-forget; errors are swallowed.
 *
 * Usage:
 *   const { variant, trackImpression, trackClick } = useAbTest("soundbytes_upgrade_modal");
 */

import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";

export type AbVariant = "A" | "B";

const SESSION_ID_KEY = "ihe_ab_session_id";

/** Generate a random 16-char hex session ID */
function generateSessionId(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Get or create a stable session ID from localStorage */
function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const id = generateSessionId();
    localStorage.setItem(SESSION_ID_KEY, id);
    return id;
  } catch {
    // localStorage unavailable (private browsing, etc.) — generate ephemeral ID
    return generateSessionId();
  }
}

/**
 * Deterministically assign a variant from a session ID string.
 * Uses a simple djb2-style hash mod 2.
 * Returns "A" or "B" with ~50/50 split.
 */
export function assignVariant(sessionId: string): AbVariant {
  let hash = 5381;
  for (let i = 0; i < sessionId.length; i++) {
    hash = (hash * 33) ^ sessionId.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash % 2 === 0 ? "A" : "B";
}

interface UseAbTestReturn {
  variant: AbVariant;
  sessionId: string;
  trackImpression: (meta?: Record<string, unknown>) => void;
  trackClick: (meta?: Record<string, unknown>) => void;
}

export function useAbTest(testId: string): UseAbTestReturn {
  const [sessionId] = useState<string>(() => getOrCreateSessionId());
  const [variant] = useState<AbVariant>(() => assignVariant(sessionId));

  const trackMutation = trpc.abTest.track.useMutation();

  // Prevent double-firing impressions within the same mount
  const impressionFired = useRef(false);

  const trackImpression = useCallback(
    (meta?: Record<string, unknown>) => {
      if (impressionFired.current) return;
      impressionFired.current = true;
      trackMutation.mutate({ testId, variant, event: "impression", sessionId, meta });
    },
    [testId, variant, sessionId, trackMutation]
  );

  const trackClick = useCallback(
    (meta?: Record<string, unknown>) => {
      trackMutation.mutate({ testId, variant, event: "click", sessionId, meta });
    },
    [testId, variant, sessionId, trackMutation]
  );

  return { variant, sessionId, trackImpression, trackClick };
}
