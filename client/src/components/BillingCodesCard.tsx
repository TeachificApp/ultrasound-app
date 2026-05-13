/**
 * BillingCodesCard
 *
 * Displays CPT procedure codes for a given ScanCoach view.
 * Only rendered for billable exam modules: TTE, TEE, Strain.
 */
import { useState } from "react";
import { Receipt, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import type { BillingSection } from "@/lib/scanCoachBillingCodes";

interface BillingCodesCardProps {
  billing: BillingSection;
  accentColor?: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  base:        { label: "Base",        color: "#189aa1", bg: "#189aa115" },
  addon:       { label: "Add-on",      color: "#7c3aed", bg: "#7c3aed12" },
  alternative: { label: "Alternative", color: "#d97706", bg: "#d9770612" },
};

export default function BillingCodesCard({ billing, accentColor = "#189aa1" }: BillingCodesCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: accentColor + "18" }}
          >
            <Receipt className="w-3.5 h-3.5" style={{ color: accentColor }} />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
              Billing Codes
            </div>
            <div className="text-xs text-gray-400">CPT procedure code reference</div>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {/* CPT Codes */}
          <div className="space-y-2">
            {billing.codes.map(({ code, description, type, note }) => {
              const badge = TYPE_LABELS[type] ?? TYPE_LABELS.base;
              return (
                <div
                  key={code}
                  className="flex items-start gap-2 p-2.5 rounded-lg group"
                  style={{ background: badge.bg, border: `1px solid ${badge.color}25` }}
                >
                  <button
                    onClick={() => handleCopy(code)}
                    className="flex-shrink-0 mt-0.5 transition-opacity"
                    title="Copy code"
                  >
                    {copiedCode === code
                      ? <Check className="w-3.5 h-3.5 text-green-500" />
                      : <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-bold font-mono"
                        style={{ color: badge.color }}
                      >
                        {code}
                      </span>
                      <span
                        className="text-xs font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: badge.color + "20", color: badge.color }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed mt-0.5">{description}</p>
                    {note && (
                      <p className="text-xs text-gray-400 italic mt-0.5">{note}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Clinical note */}
          {billing.clinicalNote && (
            <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
              {billing.clinicalNote}
            </p>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-gray-400 leading-relaxed">
            <strong className="text-gray-500">Disclaimer:</strong> Codes are provided as a reference guide only.
            Always verify with your billing department, payer contracts, and current AMA/CMS guidelines.
          </p>
        </div>
      )}
    </div>
  );
}
