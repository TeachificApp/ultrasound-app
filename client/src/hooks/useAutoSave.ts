/**
 * useAutoSave
 *
 * Tracks whether there are unsaved changes and triggers an auto-save
 * every `intervalMs` milliseconds (default 60 000 ms = 1 minute) when dirty.
 *
 * Usage:
 *   const { isDirty, markDirty, markClean, autoSaveStatus } = useAutoSave({
 *     onSave: handleSave,   // async () => void
 *     intervalMs: 60_000,
 *   });
 *
 * - Call `markDirty()` whenever the editor content changes.
 * - Call `markClean()` after a successful save (manual or auto).
 * - `autoSaveStatus` is "idle" | "saving" | "saved" | "error"
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type AutoSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface UseAutoSaveOptions {
  /** Async function that performs the save. Should throw on failure. */
  onSave: () => Promise<void>;
  /** Interval in ms between auto-save attempts when dirty. Default: 60 000 */
  intervalMs?: number;
}

export function useAutoSave({ onSave, intervalMs = 60_000 }: UseAutoSaveOptions) {
  const [isDirty, setIsDirty] = useState(false);
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const isSavingRef = useRef(false);
  const onSaveRef = useRef(onSave);
  // Keep the ref up-to-date so the interval always calls the latest version
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  const markDirty = useCallback(() => {
    setIsDirty(true);
    setStatus("dirty");
  }, []);

  const markClean = useCallback(() => {
    setIsDirty(false);
    setStatus("saved");
    // Reset back to idle after 3 s so the indicator fades away
    setTimeout(() => setStatus(s => s === "saved" ? "idle" : s), 3000);
  }, []);

  const triggerSave = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setStatus("saving");
    try {
      await onSaveRef.current();
      setIsDirty(false);
      setStatus("saved");
      setTimeout(() => setStatus(s => s === "saved" ? "idle" : s), 3000);
    } catch {
      setStatus("error");
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  // Auto-save interval — only fires when dirty
  useEffect(() => {
    const timer = setInterval(() => {
      if (isDirty && !isSavingRef.current) {
        triggerSave();
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isDirty, intervalMs, triggerSave]);

  return { isDirty, status, markDirty, markClean, triggerSave };
}
