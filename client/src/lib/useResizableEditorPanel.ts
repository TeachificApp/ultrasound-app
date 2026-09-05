import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  clampEditorSettingsPanelWidth,
  defaultEditorSettingsPanelWidth,
  preferredConvertedDocumentPanelWidth,
} from "@shared/convertedDocumentBlock";

const STORAGE_PREFIX = "editor-settings-panel-width:";

export function readStoredEditorPanelWidth(storageKey: string) {
  if (typeof window === "undefined") return defaultEditorSettingsPanelWidth();
  const saved = window.localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
  if (!saved) return defaultEditorSettingsPanelWidth();
  const parsed = Number(saved);
  if (!Number.isFinite(parsed)) return defaultEditorSettingsPanelWidth();
  return clampEditorSettingsPanelWidth(parsed);
}

export function useResizableEditorPanel(storageKey: string) {
  const [panelWidth, setPanelWidth] = useState(() => readStoredEditorPanelWidth(storageKey));
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const persistWidth = useCallback((width: number) => {
    const next = clampEditorSettingsPanelWidth(width);
    setPanelWidth(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, String(next));
    }
    return next;
  }, [storageKey]);

  const ensureWidthForConvertedDocument = useCallback(() => {
    const preferred = preferredConvertedDocumentPanelWidth();
    persistWidth(Math.max(panelWidth, preferred));
  }, [panelWidth, persistWidth]);

  useEffect(() => {
    const onResize = () => {
      setPanelWidth((current) => clampEditorSettingsPanelWidth(current));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleResizeMouseDown = useCallback((event: ReactMouseEvent) => {
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startWidth: panelWidth };
    const onMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - moveEvent.clientX;
      persistWidth(dragRef.current.startWidth + delta);
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [panelWidth, persistWidth]);

  return {
    panelWidth,
    setPanelWidth: persistWidth,
    ensureWidthForConvertedDocument,
    handleResizeMouseDown,
  };
}
