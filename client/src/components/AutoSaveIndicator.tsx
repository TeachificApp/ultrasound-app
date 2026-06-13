/**
 * AutoSaveIndicator
 *
 * A small status badge shown in editor headers to communicate auto-save state.
 * Renders nothing when status is "idle".
 */
import React from "react";
import { Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AutoSaveStatus } from "@/hooks/useAutoSave";

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
  className?: string;
}

export function AutoSaveIndicator({ status, className }: AutoSaveIndicatorProps) {
  if (status === "idle") return null;

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs font-medium transition-all duration-300",
        status === "dirty" && "text-amber-500",
        status === "saving" && "text-teal-500",
        status === "saved" && "text-green-600",
        status === "error" && "text-red-500",
        className,
      )}
    >
      {status === "dirty" && (
        <><Clock size={12} className="flex-shrink-0" /> Unsaved changes</>
      )}
      {status === "saving" && (
        <><Loader2 size={12} className="flex-shrink-0 animate-spin" /> Auto-saving…</>
      )}
      {status === "saved" && (
        <><CheckCircle2 size={12} className="flex-shrink-0" /> Saved</>
      )}
      {status === "error" && (
        <><AlertCircle size={12} className="flex-shrink-0" /> Auto-save failed</>
      )}
    </span>
  );
}
