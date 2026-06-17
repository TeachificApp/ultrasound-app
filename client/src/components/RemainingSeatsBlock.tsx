/**
 * RemainingSeatsBlock.tsx
 * Live seat availability display block.
 * Polls the server every 30 seconds for real-time updates.
 * Used by CourseLanding, WorkshopLanding, and BlockPreview.
 */

import React from "react";
import { trpc } from "@/lib/trpc";

interface RemainingSeatsBlockProps {
  data: {
    sourceType?: "workshop_instance" | "cohort_group";
    sourceId?: number | null;
    sourceName?: string;
    headline?: string;
    subtext?: string;
    showProgressBar?: boolean;
    showCount?: boolean;
    urgencyThreshold?: number;
    bgColor?: string;
    accentColor?: string;
    textColor?: string;
    fullMessage?: string;
  };
  /** If true, shows a static preview (no live data fetch) */
  preview?: boolean;
}

export function RemainingSeatsBlock({ data, preview = false }: RemainingSeatsBlockProps) {
  const {
    sourceType = "workshop_instance",
    sourceId = null,
    sourceName = "",
    headline = "Limited Seats Available",
    subtext = "Seats are filling up fast — secure yours today.",
    showProgressBar = true,
    showCount = true,
    urgencyThreshold = 5,
    bgColor = "#ffffff",
    accentColor = "#179ca3",
    textColor = "#111827",
    fullMessage = "This session is fully booked.",
  } = data;

  const isWorkshop = sourceType === "workshop_instance";

  // Workshop instance seat availability
  const workshopQuery = trpc.workshop.getSeatAvailability.useQuery(
    { instanceId: sourceId! },
    {
      enabled: !preview && isWorkshop && !!sourceId,
      refetchInterval: 30_000, // poll every 30s for real-time updates
      staleTime: 0,            // always treat as stale — fetch fresh on mount
    }
  );

  // Cohort group seat availability
  const cohortQuery = trpc.lms.getCohortSeatAvailability.useQuery(
    { cohortGroupId: sourceId! },
    {
      enabled: !preview && !isWorkshop && !!sourceId,
      refetchInterval: 30_000,
      staleTime: 0,
    }
  );

  const query = isWorkshop ? workshopQuery : cohortQuery;
  const seatData = query.data as {
    capacity: number | null;
    enrolled: number;
    remaining: number | null;
    isFull: boolean;
  } | undefined;

  // Preview mode: show static placeholder with selected instance info
  if (preview) {
    return (
      <div style={{ backgroundColor: bgColor, color: textColor }} className="py-8 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          {headline && <h3 className="text-xl font-bold">{headline}</h3>}
          {subtext && <p className="text-sm opacity-70">{subtext}</p>}
          <div className="mt-4 p-4 rounded-xl border-2 border-dashed" style={{ borderColor: accentColor + "40" }}>
            {sourceId ? (
              <p className="text-sm opacity-70">
                Preview: {sourceName || `${sourceType === "workshop_instance" ? "Workshop Instance" : "Cohort"} #${sourceId}`}
              </p>
            ) : (
              <p className="text-sm opacity-50">Select a source in the settings panel to show live seat availability.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // No sourceId selected
  if (!sourceId) {
    return (
      <div style={{ backgroundColor: bgColor, color: textColor }} className="py-8 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          {headline && <h3 className="text-xl font-bold">{headline}</h3>}
          {subtext && <p className="text-sm opacity-70">{subtext}</p>}
          <div className="mt-4 p-4 rounded-xl border-2 border-dashed" style={{ borderColor: accentColor + "40" }}>
            <p className="text-sm opacity-50">Select a source in the settings panel to show live seat availability.</p>
          </div>
        </div>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div style={{ backgroundColor: bgColor }} className="py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-gray-200 rounded w-48 mx-auto" />
            <div className="h-3 bg-gray-100 rounded w-64 mx-auto" />
            <div className="h-4 bg-gray-200 rounded w-full mt-4" />
          </div>
        </div>
      </div>
    );
  }

  if (query.isError || !seatData) {
    return null; // Fail silently on public pages
  }

  const { capacity, enrolled, remaining, isFull } = seatData;
  const isUnlimited = capacity === null;
  const pct = !isUnlimited && capacity! > 0 ? Math.min(100, Math.round((enrolled / capacity!) * 100)) : 0;
  const isUrgent = !isUnlimited && remaining !== null && remaining <= urgencyThreshold && !isFull;

  // Urgency color: red when urgent, accent when normal
  const barColor = isFull ? "#ef4444" : isUrgent ? "#f97316" : accentColor;

  if (isUnlimited) {
    // No capacity set — don't render the block (nothing meaningful to show)
    return null;
  }

  return (
    <div style={{ backgroundColor: bgColor, color: textColor }} className="py-8 px-4">
      <div className="max-w-2xl mx-auto text-center space-y-2">
        {headline && (
          <h3 className="text-xl font-bold" style={{ color: isFull ? "#ef4444" : isUrgent ? "#f97316" : textColor }}>
            {isFull ? fullMessage : headline}
          </h3>
        )}
        {!isFull && subtext && (
          <p className="text-sm" style={{ color: textColor, opacity: 0.7 }}>{subtext}</p>
        )}

        {!isFull && (
          <div className="mt-4 space-y-2">
            {showCount && remaining !== null && (
              <div className="flex items-center justify-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold"
                  style={{
                    backgroundColor: isUrgent ? "#fff7ed" : "#f0fdf4",
                    color: isUrgent ? "#c2410c" : "#166534",
                    border: `1.5px solid ${isUrgent ? "#fed7aa" : "#bbf7d0"}`,
                  }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: isUrgent ? "#f97316" : "#22c55e" }}
                  />
                  {remaining === 0
                    ? "No seats remaining"
                    : remaining === 1
                    ? "Only 1 seat remaining!"
                    : `${remaining} seat${remaining !== 1 ? "s" : ""} remaining`}
                </span>
              </div>
            )}

{/* Progress bar + total count: admin preview only */}
          </div>
        )}

        {isFull && (
          <div
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
            style={{ backgroundColor: "#fef2f2", color: "#b91c1c", border: "1.5px solid #fecaca" }}
          >
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
            Fully Booked
          </div>
        )}
      </div>
    </div>
  );
}
