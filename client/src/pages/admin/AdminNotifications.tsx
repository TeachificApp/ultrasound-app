import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bell, BellOff, CheckCheck, Trash2, RefreshCw, Filter, MessageSquareText, PieChart as PieChartIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const SOURCE_LABELS: Record<string, string> = {
  system: "System",
  lms_checkout: "LMS Checkout",
  membership: "Membership",
  physical_order: "Physical Order",
  bookvault: "BookVault",
  stripe: "Stripe",
  enrollment: "Enrollment",
  community: "Community",
};

function formatSource(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(ts: Date | string | number): string {
  const now = Date.now();
  const then = new Date(ts).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const SOURCE_COLORS: Record<string, string> = {
  system: "bg-slate-100 text-slate-700",
  lms_checkout: "bg-teal-100 text-teal-800",
  membership: "bg-purple-100 text-purple-800",
  physical_order: "bg-orange-100 text-orange-800",
  bookvault: "bg-blue-100 text-blue-800",
  stripe: "bg-violet-100 text-violet-800",
  enrollment: "bg-green-100 text-green-800",
  community: "bg-pink-100 text-pink-800",
};

const TRIAL_CANCELLATION_REASON_LABELS: Record<string, string> = {
  not_selected: "No reason selected",
  too_expensive: "Too expensive",
  not_enough_time: "Not enough time",
  missing_features: "Missing features or content",
  technical_issue: "Technical issue",
  found_an_alternative: "Found an alternative",
  other: "Other",
};

const TRIAL_CANCELLATION_COLORS = ["#0f766e", "#0891b2", "#0d9488", "#14b8a6", "#0284c7", "#64748b", "#94a3b8"];

function formatReason(reason: string) {
  return TRIAL_CANCELLATION_REASON_LABELS[reason]
    ?? reason.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function AdminNotifications() {
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data, isLoading, refetch } = trpc.adminNotifications.list.useQuery(
    {
      source: sourceFilter === "all" ? undefined : sourceFilter,
      unreadOnly,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    { refetchInterval: 30_000 }
  );

  const { data: sources } = trpc.adminNotifications.sources.useQuery();
  const { data: trialInsights, isLoading: isLoadingTrialInsights } =
    trpc.adminNotifications.trialCancellationInsights.useQuery(undefined, {
      refetchInterval: 30_000,
    });

  const utils = trpc.useUtils();

  const markRead = trpc.adminNotifications.markRead.useMutation({
    onSuccess: () => utils.adminNotifications.list.invalidate(),
  });

  const markAllRead = trpc.adminNotifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.adminNotifications.list.invalidate();
      toast.success("All notifications marked as read");
    },
  });

  const deleteNotif = trpc.adminNotifications.delete.useMutation({
    onSuccess: () => utils.adminNotifications.list.invalidate(),
  });

  const clearRead = trpc.adminNotifications.clearRead.useMutation({
    onSuccess: () => {
      utils.adminNotifications.list.invalidate();
      toast.success("Read notifications cleared");
    },
  });

  const notifications = data?.notifications ?? [];
  const total = data?.total ?? 0;
  const unreadCount = data?.unread ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const trialReasonData = useMemo(
    () => (trialInsights?.reasons ?? []).map((item, index) => ({
      label: formatReason(item.reason),
      responses: item.count,
      color: TRIAL_CANCELLATION_COLORS[index % TRIAL_CANCELLATION_COLORS.length],
    })),
    [trialInsights?.reasons],
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-teal-600" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Notifications</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? (
                <span className="text-teal-600 font-medium">{unreadCount} unread</span>
              ) : (
                "All caught up"
              )}{" "}
              · {total} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="gap-1.5"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearRead.mutate()}
            disabled={clearRead.isPending}
            className="gap-1.5 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear read
          </Button>
        </div>
      </div>

      {/* Premium Trial Cancellation Insights */}
      <Card className="mb-6 border border-teal-100 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 via-cyan-50 to-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-sm">
                <PieChartIcon className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-base text-gray-900">Premium Trial Cancellation Insights</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Aggregate feedback from three-day Premium App trial cancellations.</p>
              </div>
            </div>
            {trialInsights?.latestAt && (
              <span className="text-xs text-muted-foreground rounded-full bg-white/90 border border-teal-100 px-2.5 py-1">
                Latest response {timeAgo(trialInsights.latestAt)}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {isLoadingTrialInsights ? (
            <div className="h-56 rounded-lg bg-muted/60 animate-pulse" aria-label="Loading trial cancellation insights" />
          ) : trialReasonData.length === 0 ? (
            <div className="min-h-48 flex flex-col items-center justify-center text-center px-4">
              <MessageSquareText className="h-9 w-9 text-teal-200 mb-3" />
              <p className="font-semibold text-sm text-gray-700">No trial-cancellation feedback yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">Reason selections submitted during the three-day trial will be summarized here. Notification cleanup does not remove this reporting data.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px] gap-5 items-center">
              <div className="h-64 min-w-0" aria-label="Bar chart of Premium trial cancellation reasons">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trialReasonData} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 8 }}>
                    <CartesianGrid horizontal={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="label" width={132} tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(13, 148, 136, 0.08)" }}
                      contentStyle={{ borderRadius: 10, border: "1px solid #ccfbf1", fontSize: 12 }}
                      formatter={(value) => [`${value} response${Number(value) === 1 ? "" : "s"}`, "Selections"]}
                    />
                    <Bar dataKey="responses" radius={[0, 5, 5, 0]} maxBarSize={26}>
                      {trialReasonData.map((item) => <Cell key={item.label} fill={item.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                <div className="rounded-lg border border-teal-100 bg-teal-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-teal-700">Responses</p>
                  <p className="text-2xl font-bold text-teal-950 mt-0.5">{trialInsights?.total ?? 0}</p>
                </div>
                <div className="rounded-lg border border-cyan-100 bg-cyan-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-cyan-700">With comment</p>
                  <p className="text-2xl font-bold text-cyan-950 mt-0.5">{trialInsights?.withComment ?? 0}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filter:</span>
            </div>
            <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(0); }}>
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {(sources ?? []).map((s) => (
                  <SelectItem key={s} value={s}>{formatSource(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                id="unread-only"
                checked={unreadOnly}
                onCheckedChange={(v) => { setUnreadOnly(v); setPage(0); }}
              />
              <Label htmlFor="unread-only" className="text-sm cursor-pointer">Unread only</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BellOff className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No notifications</p>
            <p className="text-sm text-muted-foreground mt-1">
              {unreadOnly ? "No unread notifications." : "Admin events will appear here as they occur."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={`transition-colors ${!n.isRead ? "border-teal-200 bg-teal-50/30 dark:bg-teal-950/10" : ""}`}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0 mt-0.5" />
                      )}
                      <span className="font-semibold text-sm text-foreground truncate">{n.title}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          SOURCE_COLORS[n.source] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {formatSource(n.source)}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                      {n.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!n.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-teal-600 hover:text-teal-700"
                        onClick={() => markRead.mutate({ id: n.id })}
                        disabled={markRead.isPending}
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-400 hover:text-red-600"
                      onClick={() => deleteNotif.mutate({ id: n.id })}
                      disabled={deleteNotif.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
