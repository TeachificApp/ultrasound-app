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
    sourceId?: number | string | null;
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
    sourceId: rawSourceId = null,
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

  // Coerce sourceId to a valid positive number (JSON may serialize it as a string)
  const sourceId = rawSourceId != null && rawSourceId !== "" ? Number(rawSourceId) : null;
  const hasValidSourceId = sourceId != null && !isNaN(sourceId) && sourceId > 0;

  const isWorkshop = sourceType === "workshop_instance";

  // Workshop instance seat availability
  const workshopQuery = trpc.workshop.getSeatAvailability.useQuery(
    { instanceId: sourceId ?? 0 },
    {
      enabled: !preview && isWorkshop && hasValidSourceId,
      refetchInterval: 30_000, // poll every 30s for real-time updates
      staleTime: 0,            // always treat as stale — fetch fresh on mount
    }
  );

  // Cohort group seat availability
  const cohortQuery = trpc.lms.getCohortSeatAvailability.useQuery(
    { cohortGroupId: sourceId ?? 0 },
    {
      enabled: !preview && !isWorkshop && hasValidSourceId,
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

  // Preview mode: show static placeholder (no live data fetch)
  if (preview) {
    return (
      <div style={{ backgroundColor: bgColor, color: textColor }} className="py-8 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          {headline && <h3 className="text-xl font-bold">{headline}</h3>}
          {subtext && <p className="text-sm opacity-70">{subtext}</p>}
          {!hasValidSourceId && (
            <p className="text-xs opacity-40 mt-2">Select a source in the settings panel to show live seat availability.</p>
          )}
          {hasValidSourceId && (
            <p className="text-xs opacity-40 mt-2">Live data will appear on the public page.</p>
          )}
        </div>
      </div>
    );
  }

  // No sourceId selected
  if (!hasValidSourceId) {
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
    // Show a subtle error state rather than returning null silently
    return (
      <div style={{ backgroundColor: bgColor, color: textColor }} className="py-6 px-4">
        <div className="max-w-2xl mx-auto text-center">
          {headline && <h3 className="text-xl font-bold mb-1">{headline}</h3>}
          <p className="text-sm opacity-40">Seat availability temporarily unavailable.</p>
        </div>
      </div>
    );
  }

  const { capacity, enrolled, remaining, isFull } = seatData;
  const isUnlimited = capacity === null;
  const pct = !isUnlimited && capacity! > 0 ? Math.min(100, Math.round((enrolled / capacity!) * 100)) : 0;
  const isUrgent = !isUnlimited && remaining !== null && remaining <= urgencyThreshold && !isFull;

  // Urgency color: red when urgent, accent when normal
  const barColor = isFull ? "#ef4444" : isUrgent ? "#f97316" : accentColor;

  if (isUnlimited) {
    // Capacity not set — show enrolled count only (no remaining seats to display)
    return (
      <div style={{ backgroundColor: bgColor, color: textColor }} className="py-8 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-2">
          {headline && <h3 className="text-xl font-bold">{headline}</h3>}
          {subtext && <p className="text-sm" style={{ opacity: 0.7 }}>{subtext}</p>}
          <div className="mt-4">
            <span
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold"
              style={{
                backgroundColor: "#f0fdf4",
                color: "#166534",
                border: `1.5px solid #bbf7d0`,
              }}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {enrolled} enrolled
            </span>
          </div>
        </div>
      </div>
    );
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
          <div className="mt-4 space-y-3">
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

            {showProgressBar && capacity != null && capacity > 0 && (
              <div className="mt-2 space-y-1">
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-2.5 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: barColor }}
                  />
                </div>
                <p className="text-xs opacity-50">{enrolled} of {capacity} seats filled</p>
              </div>
            )}
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
