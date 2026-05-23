/**
 * UserParamTagsHelper
 *
 * A compact inline helper panel shown below URL inputs in embed/iframe/video
 * block editors. Displays all supported {{tag}} tokens with a one-click copy
 * button so editors can quickly paste them into embed URLs or HTML.
 */
import { useState } from "react";
import { Copy, Check, Info } from "lucide-react";
import { USER_PARAM_TAGS } from "@/lib/userUrlParams";

interface UserParamTagsHelperProps {
  /** Optional extra className for the wrapper */
  className?: string;
  /** If true, shows a compact single-line chip row instead of the full table */
  compact?: boolean;
}

export default function UserParamTagsHelper({ className = "", compact = false }: UserParamTagsHelperProps) {
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const handleCopy = (tag: string) => {
    navigator.clipboard.writeText(tag).then(() => {
      setCopiedTag(tag);
      setTimeout(() => setCopiedTag(null), 1800);
    });
  };

  if (compact) {
    return (
      <div className={`flex flex-wrap gap-1.5 mt-1.5 ${className}`}>
        {USER_PARAM_TAGS.map(({ tag, label }) => (
          <button
            key={tag}
            type="button"
            title={`Copy ${tag} — ${label}`}
            onClick={() => handleCopy(tag)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono border border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors"
          >
            {copiedTag === tag ? (
              <Check className="w-3 h-3 text-green-600" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            {tag}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`mt-2 rounded-lg border border-teal-200 bg-teal-50/60 p-3 ${className}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Info className="w-3.5 h-3.5 text-teal-600 shrink-0" />
        <span className="text-xs font-semibold text-teal-700">User Profile Tags</span>
        <span className="text-xs text-teal-600 ml-1">— click to copy, then paste into your URL</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {USER_PARAM_TAGS.map(({ tag, label, description }) => (
          <button
            key={tag}
            type="button"
            onClick={() => handleCopy(tag)}
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border border-teal-200 bg-white hover:bg-teal-50 text-left transition-colors group"
          >
            <div className="min-w-0">
              <span className="font-mono text-xs text-teal-800 font-semibold">{tag}</span>
              <span className="text-xs text-gray-500 ml-2">{description}</span>
            </div>
            <span className="shrink-0 text-xs text-teal-500 group-hover:text-teal-700">
              {copiedTag === tag ? (
                <Check className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Tags are replaced at render time with the logged-in user's profile data.
        They also auto-append as <code className="bg-gray-100 px-0.5 rounded">user_email</code>,{" "}
        <code className="bg-gray-100 px-0.5 rounded">user_name</code>, etc. query parameters.
      </p>
    </div>
  );
}
