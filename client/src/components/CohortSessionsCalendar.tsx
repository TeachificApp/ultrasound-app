/**
 * CohortSessionsCalendar.tsx
 * Displays published live sessions for a cohort group in either a month-grid
 * calendar view or a compact list view. Used both inline (CohortGroupEmbedSection)
 * and as a standalone embed at /embed/cohort-sessions/:groupId.
 */
import { useState, useMemo } from "react";
import { RichTextDisplay } from "@/components/RichTextEditor";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  List,
  ChevronLeft,
  ChevronRight,
  Clock,
  Video,
  ExternalLink,
  CalendarX,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(date: Date, tz?: string | null) {
  try {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz ?? "America/New_York",
      timeZoneName: "short",
    });
  } catch {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  accentColor,
  compact = false,
  showZoomJoin = true,
}: {
  session: any;
  accentColor: string;
  compact?: boolean;
  showZoomJoin?: boolean;
}) {
  const date = new Date(session.sessionDate);
  const endDate = addMinutes(date, session.durationMinutes ?? 60);
  const tz = session.timezone ?? "America/New_York";
  const isPast = date < new Date();

  return (
    <div
      className={`rounded-xl border ${compact ? "py-2 px-3" : "p-4"} ${isPast ? "opacity-60" : ""}`}
      style={{ borderColor: `${accentColor}33`, backgroundColor: `${accentColor}06` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-gray-900 truncate ${compact ? "text-sm" : "text-base"}`}>
            {session.title}
          </p>
          {!compact && session.description && (
            <RichTextDisplay content={session.description} className="text-sm text-gray-500 mt-0.5 line-clamp-2" />
          )}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              {formatTime(date, tz)} – {formatTime(endDate, tz)}
            </span>
            {session.durationMinutes && (
              <span className="text-xs text-gray-400">
                {session.durationMinutes >= 60
                  ? `${Math.floor(session.durationMinutes / 60)}h${session.durationMinutes % 60 ? ` ${session.durationMinutes % 60}m` : ""}`
                  : `${session.durationMinutes}m`}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {isPast && session.recordingUrl ? (
            <a
              href={session.recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-white"
              style={{ backgroundColor: accentColor }}
            >
              <Video className="w-3 h-3" /> Recording
            </a>
          ) : !isPast && session.meetingUrl && showZoomJoin ? (
            <a
              href={session.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-white"
              style={{ backgroundColor: accentColor }}
            >
              <ExternalLink className="w-3 h-3" /> Join
            </a>
          ) : null}
          {isPast && !session.recordingUrl && (
            <Badge variant="secondary" className="text-xs">Past</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Month Grid View ──────────────────────────────────────────────────────────

function MonthGridView({
  sessions,
  accentColor,
  showZoomJoin = true,
}: {
  sessions: any[];
  accentColor: string;
  showZoomJoin?: boolean;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(() => {
    const upcoming = sessions.find(s => new Date(s.sessionDate) >= today);
    const d = upcoming ? new Date(upcoming.sessionDate) : today;
    return d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const upcoming = sessions.find(s => new Date(s.sessionDate) >= today);
    const d = upcoming ? new Date(upcoming.sessionDate) : today;
    return d.getMonth();
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of sessions) {
      const d = new Date(s.sessionDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [sessions]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  };

  const selectedSessions = selectedDay ? (sessionsByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="font-semibold text-gray-900 text-sm">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const daySessions = sessionsByDay.get(key) ?? [];
          const isToday = today.getDate() === day && today.getMonth() === viewMonth && today.getFullYear() === viewYear;
          const isSelected = selectedDay === key;
          const hasSessions = daySessions.length > 0;
          return (
            <button
              key={key}
              onClick={() => setSelectedDay(isSelected ? null : key)}
              className={`
                relative flex flex-col items-center justify-start pt-1 pb-1 rounded-lg min-h-[40px] text-sm transition-colors
                ${isSelected ? "ring-2 ring-offset-1" : ""}
                ${hasSessions ? "cursor-pointer hover:bg-gray-50" : "cursor-default"}
                ${isToday ? "font-bold" : ""}
              `}
              style={isSelected ? { ringColor: accentColor } : undefined}
            >
              <span
                className={`w-6 h-6 flex items-center justify-center rounded-full text-xs ${isToday ? "text-white" : hasSessions ? "text-gray-900" : "text-gray-400"}`}
                style={isToday ? { backgroundColor: accentColor } : undefined}
              >
                {day}
              </span>
              {hasSessions && (
                <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: accentColor }} />
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && selectedSessions.length > 0 && (
        <div className="space-y-2 border-t pt-3 mt-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {formatDate(new Date(selectedDay + "T12:00:00"))}
          </p>
          {selectedSessions.map(s => (
            <SessionCard key={s.id} session={s} accentColor={accentColor} compact showZoomJoin={showZoomJoin} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({
  sessions,
  accentColor,
  showZoomJoin = true,
}: {
  sessions: any[];
  accentColor: string;
  showZoomJoin?: boolean;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of sessions) {
      const d = new Date(s.sessionDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
        <CalendarX className="w-8 h-8" />
        <p className="text-sm">No sessions scheduled yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(([monthKey, monthSessions]) => {
        const [year, month] = monthKey.split("-").map(Number);
        return (
          <div key={monthKey}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {MONTHS[month - 1]} {year}
            </p>
            <div className="space-y-2">
              {monthSessions.map(s => {
                const d = new Date(s.sessionDate);
                return (
                  <div key={s.id} className="flex gap-3">
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center text-white"
                      style={{ backgroundColor: d < today ? "#9ca3af" : accentColor }}
                    >
                      <span className="text-xs font-bold leading-none">{MONTHS[d.getMonth()].slice(0, 3).toUpperCase()}</span>
                      <span className="text-sm font-bold leading-none">{d.getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <SessionCard session={s} accentColor={accentColor} compact showZoomJoin={showZoomJoin} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CohortSessionsCalendar({
  cohortGroupId,
  accentColor = "#189aa1",
  defaultView = "list",
  showHeader = true,
  maxHeight,
  showZoomJoin = true,
}: {
  cohortGroupId: number;
  accentColor?: string;
  defaultView?: "calendar" | "list";
  showHeader?: boolean;
  maxHeight?: string;
  /** Whether to show the Join (Zoom) button on upcoming sessions. Defaults to true. */
  showZoomJoin?: boolean;
}) {
  const [view, setView] = useState<"calendar" | "list">(defaultView);
  const { data, isLoading, error } = trpc.lms.getCohortGroupSessions.useQuery({ cohortGroupId });

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-400">
        Could not load sessions.
      </div>
    );
  }

  const sessions = data.sessions ?? [];

  return (
    <div className="rounded-2xl border overflow-hidden bg-white" style={{ borderColor: `${accentColor}22` }}>
      {showHeader && (
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ backgroundColor: `${accentColor}08`, borderColor: `${accentColor}22` }}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: accentColor }} />
            <span className="font-semibold text-gray-900 text-sm">Live Sessions</span>
            {sessions.length > 0 && (
              <Badge variant="secondary" className="text-xs">{sessions.length}</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setView("calendar")}
              className={`p-1.5 rounded-lg transition-colors ${view === "calendar" ? "text-white" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
              style={view === "calendar" ? { backgroundColor: accentColor } : undefined}
              title="Calendar view"
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-1.5 rounded-lg transition-colors ${view === "list" ? "text-white" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
              style={view === "list" ? { backgroundColor: accentColor } : undefined}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
      <div
        className="p-4 overflow-y-auto"
        style={maxHeight ? { maxHeight } : undefined}
      >
        {view === "calendar" ? (
          <MonthGridView sessions={sessions} accentColor={accentColor} showZoomJoin={showZoomJoin} />
        ) : (
          <ListView sessions={sessions} accentColor={accentColor} showZoomJoin={showZoomJoin} />
        )}
      </div>
    </div>
  );
}

export default CohortSessionsCalendar;
