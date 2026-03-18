/**
 * CopyToReportButton
 * Copies a single calculator result into the shared Report Clipboard,
 * then shows a confirmation with a "View in Report Builder" link.
 */

import { useState } from "react";
import { ClipboardCopy, Check, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { useReportClipboard } from "@/hooks/useReportClipboard";

interface CopyToReportButtonProps {
  source: string;
  calculator: string;
  label: string;
  result: string;
  interpretation: string;
  className?: string;
}

export function CopyToReportButton({
  source,
  calculator,
  label,
  result,
  interpretation,
  className = "",
}: CopyToReportButtonProps) {
  const { addEntry } = useReportClipboard();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    addEntry({ source, calculator, label, result, interpretation });
    setCopied(true);
    setTimeout(() => setCopied(false), 3500);
  };

  return (
    <div className={`inline-flex items-center gap-2 flex-wrap ${className}`}>
      <button
        onClick={handleCopy}
        title="Copy this result to Report Builder"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
          copied
            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
            : "bg-white border-gray-200 text-gray-500 hover:border-[#189aa1] hover:text-[#189aa1] hover:bg-[#f0fbfc]"
        }`}
      >
        {copied ? (
          <>
            <Check className="w-3 h-3" />
            Copied!
          </>
        ) : (
          <>
            <ClipboardCopy className="w-3 h-3" />
            Copy to Report
          </>
        )}
      </button>
      {copied && (
        <Link href="/report?tab=clipboard">
          <span className="inline-flex items-center gap-1 text-xs text-[#189aa1] font-semibold hover:underline cursor-pointer">
            <ExternalLink className="w-3 h-3" />
            View in Report Builder
          </span>
        </Link>
      )}
    </div>
  );
}
