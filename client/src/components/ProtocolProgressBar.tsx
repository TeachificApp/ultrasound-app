import { CheckCircle2, RotateCcw } from "lucide-react";

interface ProtocolProgressBarProps {
  checked: number;
  total: number;
  onReset: () => void;
  /** Optional: show critical item count */
  checkedCritical?: number;
  totalCritical?: number;
}

export default function ProtocolProgressBar({
  checked,
  total,
  onReset,
  checkedCritical = 0,
  totalCritical = 0,
}: ProtocolProgressBarProps) {
  const progress = total > 0 ? Math.round((checked / total) * 100) : 0;
  const isComplete = total > 0 && checked === total;

  // Color transitions: 0–49% teal, 50–79% blue-teal, 80–99% emerald, 100% green
  const barColor = isComplete
    ? "#16a34a"
    : progress >= 80
    ? "#059669"
    : progress >= 50
    ? "#0891b2"
    : "#189aa1";

  return (
    <div
      className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm"
      style={{ backdropFilter: "blur(8px)" }}
    >
      <div className="container py-3">
        {isComplete ? (
          /* ── Complete state ── */
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm font-bold text-green-700">Protocol Complete!</span>
              <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                {checked}/{total} items
              </span>
            </div>
            <button
              onClick={onReset}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        ) : (
          /* ── In-progress state ── */
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600">Protocol Progress</span>
                {totalCritical > 0 && (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background: checkedCritical === totalCritical ? "#fef3c7" : "#fff7ed",
                      color: checkedCritical === totalCritical ? "#92400e" : "#c2410c",
                      border: `1px solid ${checkedCritical === totalCritical ? "#fde68a" : "#fed7aa"}`,
                    }}
                  >
                    {checkedCritical}/{totalCritical} critical
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold" style={{ color: barColor }}>
                  {checked}/{total} items · {progress}%
                </span>
                {checked > 0 && (
                  <button
                    onClick={onReset}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
              </div>
            </div>
            {/* Progress track */}
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%`, background: barColor }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
