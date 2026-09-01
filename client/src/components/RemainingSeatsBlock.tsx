/**
 * Learner-facing enrollment message block. Enrollment capacity and peer details
 * are intentionally never requested or displayed to students.
 */
import React from "react";

interface RemainingSeatsBlockProps {
  data: {
    sourceName?: string;
    headline?: string;
    subtext?: string;
    bgColor?: string;
    textColor?: string;
  };
  preview?: boolean;
}

export function RemainingSeatsBlock({ data, preview = false }: RemainingSeatsBlockProps) {
  const {
    sourceName = "",
    headline = "Enrollment Information",
    subtext = "Please review the session details and enrollment options.",
    bgColor = "#ffffff",
    textColor = "#111827",
  } = data;

  return (
    <div style={{ backgroundColor: bgColor, color: textColor }} className="px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-2 text-center">
        {headline && <h3 className="text-xl font-bold">{headline}</h3>}
        {subtext && <p className="text-sm opacity-70">{subtext}</p>}
        {preview && <p className="pt-1 text-xs opacity-45">Learners will not see attendance, capacity, or seat-count information.</p>}
        {!preview && sourceName && <p className="pt-1 text-xs opacity-45">{sourceName}</p>}
      </div>
    </div>
  );
}
