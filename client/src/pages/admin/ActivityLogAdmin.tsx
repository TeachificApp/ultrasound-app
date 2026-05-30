/**
 * ActivityLogAdmin.tsx
 * Unified activity log for platform admins — shows all user events across
 * the platform: logins, page views, lesson completions, enrollments, purchases, etc.
 *
 * Features:
 *  - Real-time paginated feed (50 events per page)
 *  - Filter by event type, date range, and user search
 *  - Color-coded event type badges
 *  - Clickable user rows → /admin/users/:id
 *  - CSV export (future)
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, RefreshCw, ChevronLeft, ChevronRight, Search,
  LogIn, BookOpen, CheckCircle, ShoppingCart, Eye, User,
  Award, FileText, LayoutDashboard, Filter, X,
} from "lucide-react";
import { getAdminUrl } from "@/hooks/useSubdomain";

// ─── Event type configuration ────────────────────────────────────────────────

const EVENT_TYPE_CONFIG: Record<string, {
  label: string;
  icon: React.ReactNode;
  badgeClass: string;
}> = {
  login:           { label: "Login",           icon: <LogIn size={12} />,        badgeClass: "bg-blue-100 text-blue-700 border-blue-200" },
  page_view:       { label: "Page View",        icon: <Eye size={12} />,          badgeClass: "bg-slate-100 text-slate-600 border-slate-200" },
  lesson_complete: { label: "Lesson Complete",  icon: <CheckCircle size={12} />,  badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  course_enroll:   { label: "Enrollment",       icon: <BookOpen size={12} />,     badgeClass: "bg-teal-100 text-teal-700 border-teal-200" },
  purchase:        { label: "Purchase",         icon: <ShoppingCart size={12} />, badgeClass: "bg-violet-100 text-violet-700 border-violet-200" },
  certificate:     { label: "Certificate",      icon: <Award size={12} />,        badgeClass: "bg-amber-100 text-amber-700 border-amber-200" },
  quiz_submit:     { label: "Quiz Submit",      icon: <FileText size={12} />,     badgeClass: "bg-orange-100 text-orange-700 border-orange-200" },
  profile_update:  { label: "Profile Update",   icon: <User size={12} />,         badgeClass: "bg-pink-100 text-pink-700 border-pink-200" },
};

const ALL_EVENT_TYPES = [
  "login", "page_view", "lesson_complete", "course_enroll",
  "purchase", "certificate", "quiz_submit", "profile_update",
];

function EventBadge({ type }: { type: string }) {
  const cfg = EVENT_TYPE_CONFIG[type];
  if (!cfg) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-100 text-gray-600 border-gray-200`}>
        <Activity size={12} /> {type}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.badgeClass}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function fmtRelative(d: Date | string | null | undefined) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  const diff = Date.now() - dt.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return fmtDate(dt);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ActivityLogAdmin() {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Filters
  const [eventType, setEventType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading, refetch, isFetching } = trpc.analytics.globalActivityLog.useQuery(
    {
      page,
      pageSize: PAGE_SIZE,
      eventType: eventType === "all" ? undefined : eventType,
      search: search || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo ? `${dateTo}T23:59:59` : undefined,
    },
    { keepPreviousData: true } as any,
  );

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const applySearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const clearFilters = useCallback(() => {
    setEventType("all");
    setSearch("");
    setSearchInput("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }, []);

  const hasActiveFilters = eventType !== "all" || search || dateFrom || dateTo;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-2">
            <a href={getAdminUrl("/platform-admin")} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <ChevronLeft className="w-3 h-3" /> Platform Admin
            </a>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Activity className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Activity Log</h1>
                <p className="text-sm text-gray-500">Real-time feed of all user events across the platform</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {total.toLocaleString()} total events
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-3">
            {/* Event type filter */}
            <div className="flex items-center gap-1.5">
              <Filter size={14} className="text-gray-400" />
              <Select value={eventType} onValueChange={(v) => { setEventType(v); setPage(1); }}>
                <SelectTrigger className="w-44 h-9 text-sm border-gray-200">
                  <SelectValue placeholder="All event types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All event types</SelectItem>
                  {ALL_EVENT_TYPES.map(t => (
                    <SelectItem key={t} value={t}>
                      {EVENT_TYPE_CONFIG[t]?.label ?? t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                className="h-9 w-36 text-sm border-gray-200"
                placeholder="From"
              />
              <span className="text-gray-400 text-xs">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1); }}
                className="h-9 w-36 text-sm border-gray-200"
                placeholder="To"
              />
            </div>

            {/* User search */}
            <div className="flex items-center gap-1.5 flex-1 min-w-48 max-w-72">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && applySearch()}
                  placeholder="Search user name or email…"
                  className="pl-8 h-9 text-sm border-gray-200"
                />
              </div>
              <Button size="sm" className="h-9 bg-violet-600 hover:bg-violet-700 text-white" onClick={applySearch}>
                Search
              </Button>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-9 gap-1 text-gray-500 hover:text-gray-700" onClick={clearFilters}>
                <X size={14} /> Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Card className="border border-gray-200 shadow-sm">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[2fr_1.5fr_3fr_1.2fr_1fr] gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide rounded-t-lg">
            <span>User</span>
            <span>Event</span>
            <span>Description</span>
            <span>IP / Path</span>
            <span>Time</span>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Activity size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">No activity found</p>
              <p className="text-xs mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {logs.map((log, i) => (
                <div
                  key={`${log.eventType}-${log.id}-${i}`}
                  className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_3fr_1.2fr_1fr] gap-2 md:gap-4 px-4 py-3 hover:bg-gray-50/80 transition-colors"
                >
                  {/* User */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <User size={13} className="text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      {log.userId ? (
                        <a
                          href={getAdminUrl(`/admin/users/${log.userId}`)}
                          className="text-sm font-medium text-gray-800 hover:text-violet-600 truncate block transition-colors"
                        >
                          {log.userName ?? `User #${log.userId}`}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-500 italic">Anonymous</span>
                      )}
                      {log.userEmail && (
                        <span className="text-xs text-gray-400 truncate block">{log.userEmail}</span>
                      )}
                    </div>
                  </div>

                  {/* Event type */}
                  <div className="flex items-center">
                    <EventBadge type={log.eventType} />
                  </div>

                  {/* Description */}
                  <div className="flex items-center min-w-0">
                    <span className="text-sm text-gray-600 truncate" title={log.description ?? ""}>
                      {log.description || <span className="italic text-gray-400">—</span>}
                    </span>
                  </div>

                  {/* IP / Path */}
                  <div className="flex flex-col justify-center min-w-0">
                    {log.ipAddress && (
                      <span className="text-xs text-gray-400 font-mono truncate">{log.ipAddress}</span>
                    )}
                    {log.path && (
                      <span className="text-xs text-gray-400 truncate" title={log.path}>{log.path}</span>
                    )}
                    {!log.ipAddress && !log.path && <span className="text-xs text-gray-300">—</span>}
                  </div>

                  {/* Time */}
                  <div className="flex items-center">
                    <span className="text-xs text-gray-400" title={fmtDate(log.createdAt)}>
                      {fmtRelative(log.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-lg">
              <span className="text-xs text-gray-500">
                Page {page} of {totalPages} &nbsp;·&nbsp; {total.toLocaleString()} events
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 border-gray-200"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} />
                </Button>
                {/* Page number pills */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  return (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      className={`h-8 w-8 p-0 text-xs ${p === page ? "bg-violet-600 hover:bg-violet-700 border-violet-600" : "border-gray-200"}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 border-gray-200"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Logins", type: "login", color: "blue" },
            { label: "Enrollments", type: "course_enroll", color: "teal" },
            { label: "Purchases", type: "purchase", color: "violet" },
            { label: "Completions", type: "lesson_complete", color: "emerald" },
          ].map(({ label, type, color }) => (
            <button
              key={type}
              onClick={() => { setEventType(type); setPage(1); }}
              className={`text-left p-3 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                eventType === type ? `border-${color}-300 ring-1 ring-${color}-200` : "border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <EventBadge type={type} />
              </div>
              <p className="text-xs text-gray-500 mt-1">Click to filter</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
