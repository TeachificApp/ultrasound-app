import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar, Clock, Video, ExternalLink, PlayCircle, FileText,
  Upload, Link2, CheckCircle, AlertCircle, BookOpen, ChevronLeft,
  Eye, Film, CheckCircle2, Download, ChevronRight, CalendarDays,
  Plus,
} from "lucide-react";
import { Link, useParams, useLocation, useSearch } from "wouter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "TBD";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(d: Date | string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}

function fmtDuration(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function isUpcoming(d: Date | string | null | undefined) {
  if (!d) return false;
  return new Date(d) > new Date();
}

function isPast(d: Date | string | null | undefined) {
  if (!d) return false;
  return new Date(d) < new Date();
}

function isDueSoon(d: Date | string | null | undefined) {
  if (!d) return false;
  const dt = new Date(d);
  const now = new Date();
  const diff = dt.getTime() - now.getTime();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

/** Returns true if the session is joinable: starts within 15 min or is currently in progress */
function isJoinable(sessionDate: Date | string | null | undefined, durationMinutes: number) {
  if (!sessionDate) return false;
  const start = new Date(sessionDate).getTime();
  const end = start + durationMinutes * 60 * 1000;
  const now = Date.now();
  const fifteenMin = 15 * 60 * 1000;
  return now >= start - fifteenMin && now <= end;
}

const submissionIcon: Record<string, React.ReactNode> = {
  text: <FileText className="w-4 h-4" />,
  file: <Upload className="w-4 h-4" />,
  url: <Link2 className="w-4 h-4" />,
  none: <CheckCircle className="w-4 h-4" />,
};

const submissionLabel: Record<string, string> = {
  text: "Text response",
  file: "File upload",
  url: "URL submission",
  none: "No submission required",
};

// ─── ICS Generation ───────────────────────────────────────────────────────────

function toIcsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function generateIcs(sessions: any[], courseTitle: string) {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UltrasoundAssist//Cohort//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${courseTitle}`,
  ];
  for (const s of sessions) {
    const start = new Date(s.sessionDate);
    const end = new Date(start.getTime() + (s.durationMinutes ?? 60) * 60 * 1000);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:cohort-session-${s.id}@ultrasoundassist`);
    lines.push(`DTSTAMP:${toIcsDate(new Date())}`);
    lines.push(`DTSTART:${toIcsDate(start)}`);
    lines.push(`DTEND:${toIcsDate(end)}`);
    lines.push(`SUMMARY:${s.title}`);
    if (s.description) lines.push(`DESCRIPTION:${s.description.replace(/\n/g, "\\n")}`);
    if (s.meetingUrl) lines.push(`URL:${s.meetingUrl}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function downloadIcs(sessions: any[], courseTitle: string) {
  const content = generateIcs(sessions, courseTitle);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${courseTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-schedule.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function googleCalendarUrl(session: any) {
  const start = new Date(session.sessionDate);
  const end = new Date(start.getTime() + (session.durationMinutes ?? 60) * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: session.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: [session.description ?? "", session.meetingUrl ? `Join: ${session.meetingUrl}` : ""].filter(Boolean).join("\n"),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ─── Calendar View ────────────────────────────────────────────────────────────

type CalView = "month" | "week" | "day" | "list";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function CohortCalendar({ sessions, courseTitle }: { sessions: any[]; courseTitle: string }) {
  const [view, setView] = useState<CalView>("month");
  const [cursor, setCursor] = useState(() => {
    // Start at the month of the first upcoming session, or today if none
    const now = new Date();
    const upcoming = sessions
      .map(s => new Date(s.sessionDate))
      .filter(d => d >= now)
      .sort((a, b) => a.getTime() - b.getTime());
    return upcoming.length > 0 ? upcoming[0] : now;
  });
  const today = new Date();
  const [now, setNow] = useState(() => Date.now());

  // Tick every minute so joinable state updates
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Navigate
  function prev() {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() - 1);
    else if (view === "week") d.setDate(d.getDate() - 7);
    else if (view === "day") d.setDate(d.getDate() - 1);
    else d.setMonth(d.getMonth() - 1);
    setCursor(d);
  }
  function next() {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + 1);
    else if (view === "week") d.setDate(d.getDate() + 7);
    else if (view === "day") d.setDate(d.getDate() + 1);
    else d.setMonth(d.getMonth() + 1);
    setCursor(d);
  }
  function goToday() { setCursor(new Date()); }

  const headerLabel = (() => {
    if (view === "month") return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (view === "week") {
      const start = new Date(cursor);
      start.setDate(cursor.getDate() - cursor.getDay());
      const end = new Date(start); end.setDate(start.getDate() + 6);
      if (start.getMonth() === end.getMonth()) return `${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
      return `${MONTHS[start.getMonth()]} – ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
    }
    if (view === "day") return cursor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  })();

  function sessionsOnDay(d: Date) {
    return sessions.filter(s => sameDay(new Date(s.sessionDate), d));
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(["month","week","day","list"] as CalView[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 rounded-md text-sm font-medium capitalize transition-colors ${view === v ? "bg-teal-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-200"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <p className="text-base font-bold text-gray-800 flex-1 text-center">{headerLabel}</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50" onClick={() => downloadIcs(sessions, courseTitle)}>
            <Download className="w-3.5 h-3.5" /> Download ICS
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={goToday}>Today</Button>
          <button onClick={prev} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"><ChevronLeft className="w-4 h-4 text-gray-600" /></button>
          <button onClick={next} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"><ChevronRight className="w-4 h-4 text-gray-600" /></button>
        </div>
      </div>

      {/* Month View */}
      {view === "month" && (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="grid grid-cols-7 border-b border-gray-200">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-teal-700 py-2 bg-teal-50/60">{d}</div>
            ))}
          </div>
          <MonthGrid cursor={cursor} today={today} sessionsOnDay={sessionsOnDay} onDayClick={d => { setCursor(d); setView("day"); }} />
        </div>
      )}

      {/* Week View */}
      {view === "week" && (
        <WeekView cursor={cursor} today={today} sessionsOnDay={sessionsOnDay} now={now} />
      )}

      {/* Day View */}
      {view === "day" && (
        <DayView cursor={cursor} today={today} sessionsOnDay={sessionsOnDay} now={now} />
      )}

      {/* List View */}
      {view === "list" && (
        <ListCalView sessions={sessions} cursor={cursor} now={now} />
      )}
    </div>
  );
}

function MonthGrid({ cursor, today, sessionsOnDay, onDayClick }: {
  cursor: Date; today: Date;
  sessionsOnDay: (d: Date) => any[];
  onDayClick: (d: Date) => void;
}) {
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const cells: (Date | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1 || dayNum > daysInMonth) cells.push(null);
    else cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), dayNum));
  }
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <div>
      {rows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0" style={{ minHeight: 90 }}>
          {row.map((d, ci) => {
            const isToday = d ? sameDay(d, today) : false;
            const evts = d ? sessionsOnDay(d) : [];
            const isCurrentMonth = d !== null;
            return (
              <div
                key={ci}
                onClick={() => d && onDayClick(d)}
                className={`p-1.5 border-r border-gray-100 last:border-r-0 cursor-pointer transition-colors ${isCurrentMonth ? "bg-teal-50/30 hover:bg-teal-50" : "bg-white"}`}
              >
                {d && (
                  <>
                    <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 ${isToday ? "bg-teal-600 text-white" : "text-gray-600"}`}>
                      {d.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {evts.slice(0, 2).map((s: any) => (
                        <div key={s.id} className="text-[10px] bg-teal-500 text-white rounded px-1 py-0.5 truncate leading-tight">{s.title}</div>
                      ))}
                      {evts.length > 2 && (
                        <div className="text-[10px] text-teal-600 font-medium">+{evts.length - 2} more</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function WeekView({ cursor, today, sessionsOnDay, now }: { cursor: Date; today: Date; sessionsOnDay: (d: Date) => any[]; now: number }) {
  const weekStart = new Date(cursor);
  weekStart.setDate(cursor.getDate() - cursor.getDay());
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="grid grid-cols-7 border-b border-gray-200">
        {days.map((d, i) => {
          const isToday = sameDay(d, today);
          return (
            <div key={i} className={`text-center py-2 ${isToday ? "bg-teal-50" : ""}`}>
              <p className="text-xs text-gray-500">{DAYS[d.getDay()]}</p>
              <p className={`text-sm font-semibold ${isToday ? "text-teal-600" : "text-gray-800"}`}>{d.getDate()}</p>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7 min-h-[200px]">
        {days.map((d, i) => {
          const evts = sessionsOnDay(d);
          const isToday = sameDay(d, today);
          return (
            <div key={i} className={`border-r border-gray-100 last:border-r-0 p-2 space-y-1.5 ${isToday ? "bg-teal-50/30" : ""}`}>
              {evts.map((s: any) => (
                <CalEventChip key={s.id} session={s} now={now} compact />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ cursor, today, sessionsOnDay, now }: { cursor: Date; today: Date; sessionsOnDay: (d: Date) => any[]; now: number }) {
  const evts = sessionsOnDay(cursor);
  const isToday = sameDay(cursor, today);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className={`px-4 py-3 border-b border-gray-200 ${isToday ? "bg-teal-50" : "bg-gray-50"}`}>
        <p className="font-semibold text-gray-800">{cursor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      </div>
      <div className="p-4 space-y-3">
        {evts.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No sessions on this day.</p>
        ) : evts.map((s: any) => (
          <CalEventChip key={s.id} session={s} now={now} />
        ))}
      </div>
    </div>
  );
}

function ListCalView({ sessions, cursor, now }: { sessions: any[]; cursor: Date; now: number }) {
  const monthSessions = sessions.filter(s => {
    const d = new Date(s.sessionDate);
    return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth();
  });
  const upcoming = sessions.filter(s => new Date(s.sessionDate) >= new Date(cursor.getFullYear(), cursor.getMonth(), 1));

  const grouped: Record<string, any[]> = {};
  for (const s of upcoming.slice(0, 30)) {
    const key = new Date(s.sessionDate).toDateString();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }

  return (
    <div className="space-y-4">
      {Object.keys(grouped).length === 0 ? (
        <Card className="text-center py-12">
          <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No upcoming sessions.</p>
        </Card>
      ) : Object.entries(grouped).map(([dateStr, evts]) => (
        <div key={dateStr}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{new Date(dateStr).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          <div className="space-y-2">
            {evts.map((s: any) => <CalEventChip key={s.id} session={s} now={now} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalEventChip({ session, now, compact }: { session: any; now: number; compact?: boolean }) {
  const joinable = isJoinable(session.sessionDate, session.durationMinutes ?? 60);
  const past = isPast(session.sessionDate);
  const start = new Date(session.sessionDate);
  const minutesUntil = Math.round((start.getTime() - now) / 60000);

  if (compact) {
    return (
      <div className="text-[10px] bg-teal-500 text-white rounded px-1.5 py-1 space-y-0.5">
        <p className="font-medium truncate">{session.title}</p>
        <p className="opacity-80">{fmtTime(session.sessionDate)}</p>
        {joinable && session.meetingUrl && (
          <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer" className="underline block">Join</a>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-3 flex items-start gap-3 ${past ? "border-gray-200 bg-white opacity-80" : joinable ? "border-teal-400 bg-teal-50/50 shadow-sm" : "border-teal-200 bg-teal-50/20"}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${past ? "bg-gray-100" : "bg-teal-100"}`}>
        <Video className={`w-4 h-4 ${past ? "text-gray-400" : "text-teal-600"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">{session.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{fmtTime(session.sessionDate)} · {fmtDuration(session.durationMinutes ?? 60)}</p>
        {!past && !joinable && minutesUntil > 0 && minutesUntil <= 120 && (
          <p className="text-xs text-amber-600 mt-0.5 font-medium">Starts in {minutesUntil} min — link available 15 min before</p>
        )}
        {joinable && session.meetingUrl && (
          <p className="text-xs text-teal-700 font-medium mt-0.5">Session is live now!</p>
        )}
        <div className="flex gap-2 mt-2 flex-wrap">
          {joinable && session.meetingUrl ? (
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 h-7 text-xs gap-1" asChild>
              <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3" /> Join Now
              </a>
            </Button>
          ) : !past && session.meetingUrl ? (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-gray-400 border-gray-200 cursor-not-allowed" disabled>
              <ExternalLink className="w-3 h-3" /> Join (opens 15 min before)
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-teal-600 hover:bg-teal-50" asChild>
            <a href={googleCalendarUrl(session)} target="_blank" rel="noopener noreferrer">
              <Plus className="w-3 h-3" /> Google Calendar
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CohortSchedule() {
  const { courseId } = useParams<{ courseId: string }>();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const isStudentPreview = urlParams.get("preview") === "student";
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const id = parseInt(courseId ?? "0", 10);
  const [now, setNow] = useState(() => Date.now());

  // Tick every minute so joinable state updates
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading, error } = trpc.lmsLearner.getCohortSchedule.useQuery(
    { courseId: id },
    { enabled: !!user && id > 0 }
  );
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading cohort schedule…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <BookOpen className="w-12 h-12 text-teal-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign in to view your cohort</h2>
          <p className="text-gray-500 mb-6">You need to be signed in and enrolled to access this cohort schedule.</p>
          <Button asChild className="bg-teal-600 hover:bg-teal-700">
            <a href={getLoginUrl()}>Sign In</a>
          </Button>
        </Card>
      </div>
    );
  }

  if ((error || !data) && !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access denied</h2>
          <p className="text-gray-500 mb-6">
            {error?.message === "You are not enrolled in this cohort"
              ? "You are not enrolled in this cohort. Please purchase the course to gain access."
              : "This cohort could not be found or you do not have access."}
          </p>
          <Button asChild variant="outline">
            <Link href="/my-dashboard?tab=content">Back to My Courses</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if ((error || !data) && isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Cohort not found</h2>
          <p className="text-gray-500 mb-6">
            This cohort ID ({id}) does not exist in the system. Make sure the course is set up as a cohort type.
          </p>
          <Button asChild variant="outline">
            <Link href="/admin/lms">Go to LMS Admin</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const { course, sessions, assignments, recordings, mySubmissions, myGroup } = data as any;
  const upcomingSessions = sessions.filter((s: any) => isUpcoming(s.sessionDate));
  const pastSessions = sessions.filter((s: any) => isPast(s.sessionDate));
  const pendingAssignments = assignments.filter((a: any) => a.dueDate && isUpcoming(a.dueDate));
  const overdueAssignments = assignments.filter((a: any) => a.dueDate && isPast(a.dueDate));
  const noDeadlineAssignments = assignments.filter((a: any) => !a.dueDate);
  const submissionMap: Record<number, any> = {};
  (mySubmissions ?? []).forEach((s: any) => { submissionMap[s.assignmentId] = s; });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Student Preview Banner */}
      {isStudentPreview && (
        <div className="bg-teal-700 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 sticky top-0 z-50">
          <Eye className="w-4 h-4" />
          <span>Student Preview — viewing Cohort Schedule as a student</span>
          <button
            onClick={() => navigate(`/courses/${(data as any)?.course?.slug ?? ''}/player`)}
            className="ml-4 px-2 py-0.5 bg-teal-800 hover:bg-teal-900 rounded text-xs"
          >
            Back to Player
          </button>
        </div>
      )}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Link href="/my-dashboard?tab=content" className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 mb-4">
            <ChevronLeft className="w-4 h-4" />
            Back to My Courses
          </Link>
          <div className="flex items-start gap-4">
            {course.thumbnailUrl && (
              <img src={course.thumbnailUrl} alt={course.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-xs">Cohort</Badge>
                {myGroup && (
                  <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-xs">
                    {myGroup.name}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{course.title}</h1>
              {course.description && (
                <div className="text-gray-500 text-sm mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: course.description }} />
              )}
            </div>
          </div>
          <div className="flex gap-6 mt-4 pt-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-2xl font-bold text-teal-600">{upcomingSessions.length}</p>
              <p className="text-xs text-gray-500">Upcoming Sessions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-700">{pastSessions.length}</p>
              <p className="text-xs text-gray-500">Past Sessions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{pendingAssignments.length}</p>
              <p className="text-xs text-gray-500">Pending Assignments</p>
            </div>
            {(recordings ?? []).length > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-teal-600">{recordings.length}</p>
                <p className="text-xs text-gray-500">Recordings</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <Tabs defaultValue="sessions">
          <TabsList className="mb-6 flex-wrap h-auto gap-1 py-1">
            <TabsTrigger value="sessions" className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
              <Video className="w-4 h-4" />
              Live Sessions
              {upcomingSessions.length > 0 && (
                <Badge className="ml-1 bg-teal-500 text-white text-xs px-1.5 py-0">{upcomingSessions.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
              <CalendarDays className="w-4 h-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="assignments" className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
              <FileText className="w-4 h-4" />
              Assignments
              {pendingAssignments.length > 0 && (
                <Badge className="ml-1 bg-amber-500 text-white text-xs px-1.5 py-0">{pendingAssignments.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="replays" className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
              <Film className="w-4 h-4" />
              Replays
              {(recordings ?? []).length > 0 && (
                <Badge className="ml-1 bg-teal-500 text-white text-xs px-1.5 py-0">{recordings.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Sessions Tab */}
          <TabsContent value="sessions">
            {sessions.length === 0 ? (
              <Card className="text-center py-16">
                <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No sessions scheduled yet</p>
                <p className="text-gray-400 text-sm mt-1">Check back soon — live sessions will appear here once published.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcomingSessions.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming</h2>
                    <div className="space-y-3">
                      {upcomingSessions.map((session: any) => (
                        <SessionCard key={session.id} session={session} isUpcoming now={now} />
                      ))}
                    </div>
                  </div>
                )}
                {pastSessions.length > 0 && (
                  <div className="mt-6">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Past Sessions</h2>
                    <div className="space-y-3">
                      {pastSessions.map((session: any) => (
                        <SessionCard key={session.id} session={session} isUpcoming={false} now={now} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar">
            <CohortCalendar sessions={sessions} courseTitle={course.title} />
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments">
            {assignments.length === 0 ? (
              <Card className="text-center py-16">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No assignments yet</p>
                <p className="text-gray-400 text-sm mt-1">Assignments will appear here once published by your instructor.</p>
              </Card>
            ) : (
              <div className="space-y-6">
                {overdueAssignments.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-red-500 uppercase tracking-wide mb-3">Overdue</h2>
                    <div className="space-y-3">
                      {overdueAssignments.map((a: any) => (
                        <AssignmentCard key={a.id} assignment={a} overdue courseId={id} mySubmission={submissionMap[a.id]} onOpen={() => navigate(`/cohort/${id}/assignment/${a.id}`)} />
                      ))}
                    </div>
                  </div>
                )}
                {pendingAssignments.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wide mb-3">Pending</h2>
                    <div className="space-y-3">
                      {pendingAssignments.map((a: any) => (
                        <AssignmentCard key={a.id} assignment={a} courseId={id} mySubmission={submissionMap[a.id]} onOpen={() => navigate(`/cohort/${id}/assignment/${a.id}`)} />
                      ))}
                    </div>
                  </div>
                )}
                {noDeadlineAssignments.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">No Deadline</h2>
                    <div className="space-y-3">
                      {noDeadlineAssignments.map((a: any) => (
                        <AssignmentCard key={a.id} assignment={a} courseId={id} mySubmission={submissionMap[a.id]} onOpen={() => navigate(`/cohort/${id}/assignment/${a.id}`)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Replays Tab */}
          <TabsContent value="replays">
            {(recordings ?? []).length === 0 ? (
              <Card className="text-center py-16">
                <Film className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No recordings yet</p>
                <p className="text-gray-400 text-sm mt-1">Session recordings will appear here once uploaded by your instructor.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {recordings.map((rec: any) => (
                  <RecordingCard key={rec.id} recording={rec} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── SessionCard ──────────────────────────────────────────────────────────────

function SessionCard({ session, isUpcoming: isUpcomingProp, now }: { session: any; isUpcoming: boolean; now: number }) {
  const hasMeetingLink = !!session.meetingUrl;
  const hasRecording = !!session.recordingUrl;
  const tz = session.timezone ?? "";
  const joinable = isJoinable(session.sessionDate, session.durationMinutes ?? 60);
  const start = new Date(session.sessionDate);
  const minutesUntil = Math.round((start.getTime() - now) / 60000);

  return (
    <Card className={`border ${isUpcomingProp ? "border-teal-200 bg-teal-50/30" : "border-gray-200 bg-white opacity-80"}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isUpcomingProp ? "bg-teal-100" : "bg-gray-100"}`}>
            <Video className={`w-5 h-5 ${isUpcomingProp ? "text-teal-600" : "text-gray-400"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 text-base leading-tight">{session.title}</h3>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {session.recurrenceRule && (
                  <Badge variant="outline" className="text-[10px] text-gray-400">Recurring</Badge>
                )}
                {joinable ? (
                  <Badge className="bg-green-500 text-white text-xs animate-pulse">Live Now</Badge>
                ) : isUpcomingProp ? (
                  <Badge className="bg-teal-500 text-white text-xs">Upcoming</Badge>
                ) : hasRecording ? (
                  <Badge variant="outline" className="text-xs text-gray-500">Recorded</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-gray-400">Completed</Badge>
                )}
              </div>
            </div>
            {session.description && (
              <p className="text-gray-500 text-sm mt-1 line-clamp-2">{session.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {fmtDate(session.sessionDate)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {fmtTime(session.sessionDate)} · {fmtDuration(session.durationMinutes)}
                {tz && <span className="text-gray-400 text-xs ml-1">({tz})</span>}
              </span>
            </div>
            {isUpcomingProp && hasMeetingLink && !joinable && minutesUntil > 0 && minutesUntil <= 120 && (
              <p className="text-xs text-amber-600 mt-1 font-medium">
                Join link available in {minutesUntil} min (15 min before start)
              </p>
            )}
            <div className="flex gap-2 mt-3 flex-wrap">
              {isUpcomingProp && hasMeetingLink && joinable && (
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700 h-8 text-xs gap-1.5" asChild>
                  <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Join Live Session
                  </a>
                </Button>
              )}
              {isUpcomingProp && hasMeetingLink && !joinable && (
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-gray-400 border-gray-200 cursor-not-allowed" disabled>
                  <ExternalLink className="w-3.5 h-3.5" />
                  Join Live Session (opens 15 min before)
                </Button>
              )}
              {hasRecording && (
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50" asChild>
                  <a href={session.recordingUrl} target="_blank" rel="noopener noreferrer">
                    <PlayCircle className="w-3.5 h-3.5" />
                    Watch Recording
                  </a>
                </Button>
              )}
              {isUpcomingProp && (
                <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-teal-600 hover:bg-teal-50" asChild>
                  <a href={googleCalendarUrl(session)} target="_blank" rel="noopener noreferrer">
                    <Plus className="w-3.5 h-3.5" />
                    Add to Google Calendar
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── AssignmentCard ───────────────────────────────────────────────────────────

function AssignmentCard({ assignment, overdue, courseId, mySubmission, onOpen }: {
  assignment: any;
  overdue?: boolean;
  courseId: number;
  mySubmission?: any;
  onOpen: () => void;
}) {
  const dueSoon = !overdue && isDueSoon(assignment.dueDate);
  const isSubmitted = !!mySubmission;
  const isGraded = mySubmission?.status === "graded";

  return (
    <Card
      className={`border cursor-pointer hover:shadow-md transition-shadow ${overdue && !isSubmitted ? "border-red-200 bg-red-50/20" : dueSoon ? "border-amber-200 bg-amber-50/20" : isGraded ? "border-green-200 bg-green-50/10" : isSubmitted ? "border-blue-200 bg-blue-50/10" : "border-gray-200 bg-white"}`}
      onClick={onOpen}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${overdue && !isSubmitted ? "bg-red-100" : dueSoon ? "bg-amber-100" : isGraded ? "bg-green-100" : isSubmitted ? "bg-blue-100" : "bg-gray-100"}`}>
            {isGraded ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : isSubmitted ? (
              <CheckCircle className="w-5 h-5 text-blue-500" />
            ) : (
              <FileText className={`w-5 h-5 ${overdue && !isSubmitted ? "text-red-500" : dueSoon ? "text-amber-600" : "text-gray-400"}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 text-base leading-tight">{assignment.title}</h3>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isGraded && <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Graded</Badge>}
                {isSubmitted && !isGraded && <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Submitted</Badge>}
                {overdue && !isSubmitted && <Badge className="bg-red-500 text-white text-xs">Overdue</Badge>}
                {dueSoon && !overdue && !isSubmitted && <Badge className="bg-amber-500 text-white text-xs">Due Soon</Badge>}
                {(assignment.maxPoints ?? assignment.points) > 0 && (
                  <Badge variant="outline" className="text-xs text-gray-500">{assignment.maxPoints ?? assignment.points} pts</Badge>
                )}
              </div>
            </div>
            {assignment.description && (
              <p className="text-gray-500 text-sm mt-1 line-clamp-2">{assignment.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
              {assignment.dueDate ? (
                <span className={`flex items-center gap-1 ${overdue && !isSubmitted ? "text-red-500 font-medium" : dueSoon ? "text-amber-600 font-medium" : ""}`}>
                  <Calendar className="w-3.5 h-3.5" />
                  Due {fmtDate(assignment.dueDate)}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-gray-400">
                  <Calendar className="w-3.5 h-3.5" />
                  No deadline
                </span>
              )}
              <span className="flex items-center gap-1">
                {submissionIcon[assignment.submissionType] ?? <CheckCircle className="w-3.5 h-3.5" />}
                {submissionLabel[assignment.submissionType] ?? "Submission required"}
              </span>
            </div>
            {isGraded && mySubmission?.grade != null && (
              <div className="mt-2 text-sm text-green-700 font-medium">
                Grade: {mySubmission.grade}{assignment.points ? ` / ${assignment.points}` : ""}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── RecordingCard ────────────────────────────────────────────────────────────

function RecordingCard({ recording }: { recording: any }) {
  const hasVideo = !!recording.videoUrl;
  const hasEmbed = !!recording.embedCode;

  return (
    <Card className="border border-gray-200 bg-white">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-teal-100">
            <Film className="w-5 h-5 text-teal-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 text-base leading-tight">{recording.title}</h3>
              <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-xs flex-shrink-0">Recording</Badge>
            </div>
            {recording.description && (
              <p className="text-gray-500 text-sm mt-1 line-clamp-2">{recording.description}</p>
            )}
            {recording.sessionDate && (
              <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                <Calendar className="w-3.5 h-3.5" />
                Session: {fmtDate(recording.sessionDate)}
              </div>
            )}
            {hasEmbed && (
              <div className="mt-3 rounded-lg overflow-hidden border border-gray-200"
                dangerouslySetInnerHTML={{ __html: recording.embedCode }}
              />
            )}
            {hasVideo && !hasEmbed && (
              <div className="mt-3">
                <video
                  src={recording.videoUrl}
                  controls
                  className="w-full rounded-lg border border-gray-200 max-h-[360px]"
                  preload="metadata"
                />
              </div>
            )}
            {!hasEmbed && recording.externalUrl && (
              <Button size="sm" variant="outline" className="mt-3 h-8 text-xs gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50" asChild>
                <a href={recording.externalUrl} target="_blank" rel="noopener noreferrer">
                  <PlayCircle className="w-3.5 h-3.5" />
                  Watch Recording
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

