import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bell, BellOff, CheckCheck, Trash2, RefreshCw, Filter } from "lucide-react";

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
