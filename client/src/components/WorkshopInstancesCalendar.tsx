/**
 * WorkshopInstancesCalendar.tsx
 * Displays workshop instances in either a month-grid calendar or grouped list view.
 * Uses workshop instance start/end dates directly rather than separate session rows.
 */
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar, CalendarX, Clock, ExternalLink, List, MapPin } from "lucide-react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatTime(date: Date, timezone = "America/New_York") {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    }).format(date);
  } catch {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
}

function formatDayLabel(date: Date, timezone = "America/New_York") {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: timezone,
    }).format(date);
  } catch {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
}

function getLocationLabel(instance: any) {
  if (instance.locationType === "virtual") return "Virtual / Online";
  const parts = [instance.venueName, instance.venueCity, instance.venueState].filter(Boolean);
  return parts.join(", ") || null;
}

function getEndDate(instance: any) {
  if (instance.endDate) return new Date(instance.endDate);
  const start = new Date(instance.startDate);
  return new Date(start.getTime() + (instance.durationMinutes ?? 60) * 60 * 1000);
}

function InstanceCard({
  instance,
  accentColor,
  compact = false,
  showZoomJoin = true,
}: {
  instance: any;
  accentColor: string;
  compact?: boolean;
  showZoomJoin?: boolean;
}) {
  const start = new Date(instance.startDate);
  const end = getEndDate(instance);
  const tz = instance.timezone ?? "America/New_York";
  const isPast = end.getTime() < Date.now();
  const location = getLocationLabel(instance);

  return (
    <div
      className={`rounded-xl border ${compact ? "py-2 px-3" : "p-4"} ${isPast ? "opacity-60" : ""}`}
      style={{ borderColor: `${accentColor}33`, backgroundColor: `${accentColor}06` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-gray-900 truncate ${compact ? "text-sm" : "text-base"}`}>
            {instance.title}
          </p>
          {!compact && instance.description && (
            <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{instance.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              {formatTime(start, tz)} – {formatTime(end, tz)}
            </span>
            {instance.durationMinutes && (
              <span className="text-xs text-gray-400">
                {instance.durationMinutes >= 60
                  ? `${Math.floor(instance.durationMinutes / 60)}h${instance.durationMinutes % 60 ? ` ${instance.durationMinutes % 60}m` : ""}`
                  : `${instance.durationMinutes}m`}
              </span>
            )}
            {location && !compact && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="w-3 h-3" />
                {location}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {!isPast && instance.meetingUrl && showZoomJoin ? (
            <a
              href={instance.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-white"
              style={{ backgroundColor: accentColor }}
            >
              <ExternalLink className="w-3 h-3" /> Join
            </a>
          ) : isPast ? (
            <Badge variant="secondary" className="text-xs">Past</Badge>
          ) : null}
        </div>
      </div>
      {!compact && (
        <div className="mt-2 text-xs text-gray-500">{formatDayLabel(start, tz)}</div>
      )}
    </div>
  );
}

function MonthGridView({
  instances,
  accentColor,
  showZoomJoin = true,
}: {
  instances: any[];
  accentColor: string;
  showZoomJoin?: boolean;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(() => {
    const upcoming = instances.find(i => new Date(i.startDate) >= today);
    const d = upcoming ? new Date(upcoming.startDate) : today;
    return d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const upcoming = instances.find(i => new Date(i.startDate) >= today);
    const d = upcoming ? new Date(upcoming.startDate) : today;
    return d.getMonth();
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const instancesByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const i of instances) {
      const d = new Date(i.startDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    }
    return map;
  }, [instances]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthTitle = `${MONTHS[viewMonth]} ${viewYear}`;
  const selectedInstances = selectedDay ? (instancesByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            const prev = new Date(viewYear, viewMonth - 1, 1);
            setViewYear(prev.getFullYear());
            setViewMonth(prev.getMonth());
            setSelectedDay(null);
          }}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          Previous
        </button>
        <p className="font-semibold text-sm text-gray-900">{monthTitle}</p>
        <button
          onClick={() => {
            const next = new Date(viewYear, viewMonth + 1, 1);
            setViewYear(next.getFullYear());
            setViewMonth(next.getMonth());
            setSelectedDay(null);
          }}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          Next
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-gray-400 uppercase">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="py-1">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="aspect-square rounded-lg bg-gray-50/60" />;
          const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayInstances = instancesByDay.get(key) ?? [];
          const isSelected = selectedDay === key;
          const isToday = (() => {
            const now = new Date();
            return now.getFullYear() === viewYear && now.getMonth() === viewMonth && now.getDate() === day;
          })();
          return (
            <button
              key={key}
              onClick={() => setSelectedDay(key)}
              className={`aspect-square rounded-xl border p-1.5 text-left transition-all ${isSelected ? "shadow-sm" : "hover:bg-gray-50"}`}
              style={{
                borderColor: isSelected ? accentColor : dayInstances.length > 0 ? `${accentColor}33` : "#e5e7eb",
                backgroundColor: isSelected ? `${accentColor}12` : dayInstances.length > 0 ? `${accentColor}08` : "white",
              }}
            >
              <div className="flex h-full flex-col">
                <span className={`text-xs font-semibold ${isToday ? "text-white w-5 h-5 rounded-full flex items-center justify-center" : "text-gray-700"}`} style={isToday ? { backgroundColor: accentColor } : undefined}>
                  {day}
                </span>
                <div className="mt-auto space-y-1">
                  {dayInstances.slice(0, 2).map((i: any) => (
                    <div
                      key={i.id}
                      className="truncate rounded px-1 py-0.5 text-[10px] text-white"
                      style={{ backgroundColor: accentColor }}
                    >
                      {i.title}
                    </div>
                  ))}
                  {dayInstances.length > 2 && (
                    <div className="text-[10px] text-gray-500 px-1">+{dayInstances.length - 2} more</div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="space-y-3 pt-2">
          <div className="text-sm font-semibold text-gray-900">
            {(() => {
              const d = new Date(selectedDay + "T12:00:00");
              return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
            })()}
          </div>
          {selectedInstances.length > 0 ? (
            selectedInstances.map((instance: any) => (
              <InstanceCard
                key={instance.id}
                instance={instance}
                accentColor={accentColor}
                showZoomJoin={showZoomJoin}
              />
            ))
          ) : (
            <div className="text-sm text-gray-400">No workshop dates scheduled for this day.</div>
          )}
        </div>
      )}
    </div>
  );
}

function ListView({
  instances,
  accentColor,
  showZoomJoin = true,
}: {
  instances: any[];
  accentColor: string;
  showZoomJoin?: boolean;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const i of instances) {
      const d = new Date(i.startDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [instances]);

  if (instances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
        <CalendarX className="w-8 h-8" />
        <p className="text-sm">No workshop dates scheduled yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(([key, monthInstances]) => {
        const [year, month] = key.split("-").map(Number);
        return (
          <div key={key} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-gray-200" />
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {MONTHS[month - 1]} {year}
              </div>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="space-y-3">
              {monthInstances.map((instance: any) => {
                const d = new Date(instance.startDate);
                return (
                  <div key={instance.id} className="flex gap-3">
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center text-white"
                      style={{ backgroundColor: getEndDate(instance) < new Date() ? "#9ca3af" : accentColor }}
                    >
                      <span className="text-xs font-bold leading-none">{MONTHS[d.getMonth()].slice(0, 3).toUpperCase()}</span>
                      <span className="text-sm font-bold leading-none">{d.getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <InstanceCard
                        instance={instance}
                        accentColor={accentColor}
                        compact
                        showZoomJoin={showZoomJoin}
                      />
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

export function WorkshopInstancesCalendar({
  instances,
  accentColor = "#189aa1",
  defaultView = "list",
  showHeader = true,
  maxHeight,
  showZoomJoin = true,
}: {
  instances: any[];
  accentColor?: string;
  defaultView?: "calendar" | "list";
  showHeader?: boolean;
  maxHeight?: string;
  showZoomJoin?: boolean;
}) {
  const [view, setView] = useState<"calendar" | "list">(defaultView);

  return (
    <div className="rounded-2xl border overflow-hidden bg-white" style={{ borderColor: `${accentColor}22` }}>
      {showHeader && (
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ backgroundColor: `${accentColor}08`, borderColor: `${accentColor}22` }}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: accentColor }} />
            <span className="font-semibold text-gray-900 text-sm">Workshop Schedule</span>
            {instances.length > 0 && (
              <Badge variant="secondary" className="text-xs">{instances.length}</Badge>
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
      <div className="p-4 overflow-y-auto" style={maxHeight ? { maxHeight } : undefined}>
        {view === "calendar" ? (
          <MonthGridView instances={instances} accentColor={accentColor} showZoomJoin={showZoomJoin} />
        ) : (
          <ListView instances={instances} accentColor={accentColor} showZoomJoin={showZoomJoin} />
        )}
      </div>
    </div>
  );
}

export default WorkshopInstancesCalendar;
