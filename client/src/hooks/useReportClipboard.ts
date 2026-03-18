/**
 * useReportClipboard
 * Shared localStorage-backed store that lets any calculator page push
 * individual findings into the Report Builder with one click.
 *
 * Storage key: "ihe_report_clipboard"
 */

import { useState, useCallback, useEffect } from "react";

export interface ReportClipboardEntry {
  id: string;
  source: string;        // e.g. "FetalEchoAssist™"
  calculator: string;    // e.g. "Celermajer Index"
  label: string;         // short result label, e.g. "Celermajer Index: 0.28"
  result: string;        // full result line, e.g. "0.28 — Normal (< 0.35)"
  interpretation: string;
  timestamp: number;
}

const STORAGE_KEY = "ihe_report_clipboard";

function readStore(): ReportClipboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ReportClipboardEntry[];
  } catch {
    return [];
  }
}

function writeStore(entries: ReportClipboardEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new Event("ihe_report_clipboard_change"));
  } catch {
    // Storage unavailable — silently ignore
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useReportClipboard() {
  const [entries, setEntries] = useState<ReportClipboardEntry[]>(readStore);

  useEffect(() => {
    const sync = () => setEntries(readStore());
    window.addEventListener("ihe_report_clipboard_change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ihe_report_clipboard_change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const addEntry = useCallback(
    (entry: Omit<ReportClipboardEntry, "id" | "timestamp">) => {
      const newEntry: ReportClipboardEntry = {
        ...entry,
        id: generateId(),
        timestamp: Date.now(),
      };
      const updated = [newEntry, ...readStore()];
      writeStore(updated);
      setEntries(updated);
      return newEntry;
    },
    []
  );

  const removeEntry = useCallback((id: string) => {
    const updated = readStore().filter((e) => e.id !== id);
    writeStore(updated);
    setEntries(updated);
  }, []);

  const clearAll = useCallback(() => {
    writeStore([]);
    setEntries([]);
  }, []);

  return { entries, addEntry, removeEntry, clearAll, count: entries.length };
}
