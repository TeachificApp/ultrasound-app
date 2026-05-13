/**
 * EchoAssistEngineLink
 *
 * A compact banner/button that links directly to a specific EchoAssist™ engine.
 * Clicking the main area navigates to /echoassist#<engineId>.
 * Clicking the copy icon copies the direct URL to clipboard.
 *
 * Usage:
 *   <EchoAssistEngineLink engineId="engine-diastolic" label="DiastologyAssist™" description="Step 1 + Step 2 diastolic assessment" />
 */

import { useState } from "react";
import { Link2, Check, ExternalLink } from "lucide-react";

export interface EchoAssistEngineLinkProps {
  engineId: string;
  label: string;
  description?: string;
  /** Optional query-string params to pre-fill the engine, e.g. { ef: "55" } */
  params?: Record<string, string>;
  className?: string;
}

export default function EchoAssistEngineLink({
  engineId,
  label,
  description,
  params,
  className = "",
}: EchoAssistEngineLinkProps) {
  const [copied, setCopied] = useState(false);

  const qs = params && Object.keys(params).length > 0
    ? "?" + new URLSearchParams(params).toString()
    : "";
  const href = `/echoassist${qs}#${engineId}`;
  const fullUrl = `${window.location.origin}${href}`;

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-[#189aa1]/20 bg-[#f0fbfc] hover:bg-[#e0f7f8] transition-colors group ${className}`}
    >
      {/* Main navigate area */}
      <a
        href={href}
        className="flex-1 flex items-center gap-2.5 px-3 py-2.5 min-w-0"
        title={`Open ${label} in EchoAssist™`}
      >
        <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #189aa1, #0e7490)" }}>
          <ExternalLink className="w-3 h-3 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#0e7490] truncate">{label}</p>
          {description && (
            <p className="text-[10px] text-[#189aa1]/70 truncate">{description}</p>
          )}
        </div>
        <span className="ml-auto text-[10px] font-semibold text-[#189aa1] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          Open →
        </span>
      </a>

      {/* Copy link button */}
      <button
        onClick={handleCopy}
        title="Copy direct link"
        className="flex-shrink-0 p-2 mr-1 rounded hover:bg-[#189aa1]/10 transition-colors"
      >
        {copied
          ? <Check className="w-3.5 h-3.5 text-[#189aa1]" />
          : <Link2 className="w-3.5 h-3.5 text-[#189aa1]/50 hover:text-[#189aa1]" />}
      </button>
    </div>
  );
}

/** Convenience: render a labelled group of engine links */
export function EchoAssistEngineLinkGroup({
  title,
  links,
}: {
  title?: string;
  links: EchoAssistEngineLinkProps[];
}) {
  return (
    <div className="mt-4">
      {title && (
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          {title}
        </p>
      )}
      <div className="space-y-1.5">
        {links.map(l => (
          <EchoAssistEngineLink key={l.engineId} {...l} />
        ))}
      </div>
    </div>
  );
}
