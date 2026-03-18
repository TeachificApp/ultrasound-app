/**
 * NotificationBell — Physician Peer Review notification system
 *
 * Shows a bell icon in the header with an unread badge count.
 * On click, opens a dropdown panel listing all notifications.
 * Each notification shows the review result summary and links to the full review.
 */
import { useState, useRef, useEffect } from "react";
import { Bell, BellRing, CheckCheck, X, Stethoscope, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const BRAND = "#189aa1";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  payload?: {
    concordanceScore?: number;
    discordantFields?: string[];
    reviewerName?: string;
    examType?: string;
    examDate?: string;
  } | null;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Queries
  const { data: unreadCount = 0, refetch: refetchCount } =
    trpc.notification.getUnreadCount.useQuery(undefined, {
      refetchInterval: 30_000, // poll every 30s
    });

  const { data: notifications = [], refetch: refetchList } =
    trpc.notification.getMyNotifications.useQuery(undefined, {
      enabled: open,
    });

  // Mutations
  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => { refetchCount(); refetchList(); },
  });
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => { refetchCount(); refetchList(); },
  });
  const dismiss = trpc.notification.dismiss.useMutation({
    onSuccess: () => { refetchCount(); refetchList(); },
  });

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    setOpen(v => !v);
  };

  const handleMarkRead = (id: number) => {
    markRead.mutate({ id });
  };

  const getConcordanceColor = (score?: number) => {
    if (score == null) return "text-gray-500";
    if (score >= 90) return "text-emerald-600";
    if (score >= 75) return "text-amber-600";
    return "text-red-600";
  };

  const getConcordanceBg = (score?: number) => {
    if (score == null) return "bg-gray-100";
    if (score >= 90) return "bg-emerald-50 border-emerald-200";
    if (score >= 75) return "bg-amber-50 border-amber-200";
    return "bg-red-50 border-red-200";
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={bellRef}
        onClick={handleOpen}
        className={cn(
          "relative p-2 rounded-lg transition-colors",
          open
            ? "bg-[#189aa1]/10 text-[#189aa1]"
            : "text-gray-500 hover:text-[#189aa1] hover:bg-[#189aa1]/5",
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5" style={{ color: BRAND }} />
        ) : (
          <Bell className="w-5 h-5" />
        )}
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1"
            style={{ background: BRAND }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
          style={{ maxHeight: "520px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4" style={{ color: BRAND }} />
              <span className="font-semibold text-gray-800 text-sm">Peer Review Notifications</span>
              {unreadCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-xs px-1.5 py-0"
                  style={{ background: `${BRAND}15`, color: BRAND }}
                >
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-xs text-gray-500 hover:text-[#189aa1] flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto" style={{ maxHeight: "440px" }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                  style={{ background: `${BRAND}10` }}
                >
                  <Bell className="w-6 h-6" style={{ color: BRAND }} />
                </div>
                <p className="text-sm font-medium text-gray-700">No notifications yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  You'll be notified when a Physician Peer Review is completed for your studies.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {(notifications as Notification[]).map(n => (
                  <div
                    key={n.id}
                    className={cn(
                      "px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer group",
                      !n.isRead && "bg-[#189aa1]/3",
                    )}
                    onClick={() => !n.isRead && handleMarkRead(n.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${BRAND}12` }}
                      >
                        <Stethoscope className="w-4 h-4" style={{ color: BRAND }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            "text-xs font-semibold leading-snug line-clamp-2",
                            n.isRead ? "text-gray-600" : "text-gray-800",
                          )}>
                            {n.title}
                          </p>
                          <button
                            onClick={e => { e.stopPropagation(); dismiss.mutate({ id: n.id }); }}
                            className="flex-shrink-0 p-0.5 rounded text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Dismiss"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Concordance Score Pill */}
                        {n.payload?.concordanceScore != null && (
                          <div className={cn(
                            "inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold",
                            getConcordanceBg(n.payload.concordanceScore),
                          )}>
                            <span className={getConcordanceColor(n.payload.concordanceScore)}>
                              {n.payload.concordanceScore}% Concordance
                            </span>
                          </div>
                        )}

                        {/* Discordant fields preview */}
                        {n.payload?.discordantFields && n.payload.discordantFields.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                            Discordant: {n.payload.discordantFields.slice(0, 3).join(", ")}
                            {n.payload.discordantFields.length > 3 && ` +${n.payload.discordantFields.length - 3} more`}
                          </p>
                        )}

                        {/* Reviewer + time */}
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs text-gray-400">
                            {n.payload?.reviewerName && `By ${n.payload.reviewerName} · `}
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </span>
                          {!n.isRead && (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: BRAND }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2.5">
              <p className="text-xs text-gray-400 text-center">
                Showing last {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
