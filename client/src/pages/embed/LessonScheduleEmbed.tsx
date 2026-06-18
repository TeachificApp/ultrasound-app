/**
 * LessonScheduleEmbed.tsx
 * Standalone iframe-embeddable page that renders the live session schedule
 * for a specific cohort group, intended for embedding inside lesson pages or
 * external websites.
 *
 * Route: /embed/lesson-schedule/:groupId
 * Query params:
 *   - view: "list" | "calendar"  (default: "list")
 *   - color: hex without # (default: "189aa1")
 *   - maxHeight: CSS value (default: "600px")
 *   - hideHeader: "1" to hide the header bar
 *   - hideZoom: "1" to hide the Join (Zoom) button on upcoming sessions
 */
import { useParams, useSearch } from "wouter";
import { CohortSessionsCalendar } from "@/components/CohortSessionsCalendar";

export default function LessonScheduleEmbed() {
  const params = useParams<{ groupId: string }>();
  const search = useSearch();
  const sp = new URLSearchParams(search);

  const groupId = Number(params.groupId);
  const view = (sp.get("view") === "calendar" ? "calendar" : "list") as "list" | "calendar";
  const accentColor = `#${sp.get("color") ?? "189aa1"}`;
  const maxHeight = sp.get("maxHeight") ?? "600px";
  const showHeader = sp.get("hideHeader") !== "1";
  const showZoomJoin = sp.get("hideZoom") !== "1";

  if (!groupId || isNaN(groupId)) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-gray-400">
        Invalid cohort group ID.
      </div>
    );
  }

  return (
    <div className="p-3 bg-transparent">
      <CohortSessionsCalendar
        cohortGroupId={groupId}
        accentColor={accentColor}
        defaultView={view}
        showHeader={showHeader}
        maxHeight={maxHeight}
        showZoomJoin={showZoomJoin}
      />
    </div>
  );
}
