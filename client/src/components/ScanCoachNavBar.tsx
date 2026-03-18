/*
  ScanCoachNavBar — Compact navigation bar for ScanCoach sub-pages
  Renders "← ScanCoach Hub" on the left and "Go to Navigator →" on the right
*/
import { Link } from "wouter";
import { ChevronLeft, ExternalLink } from "lucide-react";

const BRAND = "#189aa1";
const AQUA = "#4ad9e0";

interface ScanCoachNavBarProps {
  /** Route for the related Navigator, e.g. "/stress" */
  navigatorPath: string;
  /** Display label for the Navigator, e.g. "Stress Navigator" */
  navigatorLabel: string;
  /** Optional extra Tailwind classes on the wrapper */
  className?: string;
}

export default function ScanCoachNavBar({
  navigatorPath,
  navigatorLabel,
  className = "",
}: ScanCoachNavBarProps) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white ${className}`}
    >
      {/* Back to ScanCoach Hub */}
      <Link href="/scan-coach-hub">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity"
          style={{ color: BRAND }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          ScanCoach Hub
        </span>
      </Link>

      {/* Go to Navigator */}
      <Link href={navigatorPath}>
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-75 transition-opacity"
          style={{ color: AQUA }}
        >
          Go to {navigatorLabel}
          <ExternalLink className="w-3.5 h-3.5" />
        </span>
      </Link>
    </div>
  );
}
