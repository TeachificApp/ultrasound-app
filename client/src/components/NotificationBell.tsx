/**
 * NotificationBell — Unified notification system
 *
 * For regular users: shows Physician Peer Review notifications.
 * For admin users: shows both peer review notifications AND all admin notifications
 * (enrollments, orders, form submissions, system alerts, etc.).
 */
import { useState, useRef, useEffect } from "react";
import {
  Bell, BellRing, CheckCheck, X, Stethoscope, ChevronRight,
  ShoppingCart, Users, FileText, AlertCircle, Info, Zap,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/_core/hooks/useAuth";

const BRAND = "#189aa1";

interface PeerNotification {
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

interface AdminNotification {
  id: number;
  title: string;
  content: string;
  source: string;
  isRead: boolean;
  createdAt: Date;
}

// ─── Icon by source ───────────────────────────────────────────────────────────
function AdminNotifIcon({ source }: { source: string }) {
  const cls = "w-4 h-4";
  if (source.includes("checkout") || source.includes("order") || source.includes("stripe")) {
    return <ShoppingCart className={cls} style={{ color: BRAND }} />;
  }
  if (source.includes("enroll") || source.includes("member") || source.includes("user")) {
    return <Users className={cls} style={{ color: BRAND }} />;
  }
  if (source.includes("form") || source.includes("submission") || source.includes("disclosure")) {
    return <FileText className={cls} style={{ color: BRAND }} />;
  }
  if (source.includes("alert") || source.includes("error") || source.includes("warn")) {
    return <AlertCircle className={cls} style={{ color: "#ef4444" }} />;
  }
  if (source.includes("system")) {
    return <Zap className={cls} style={{ color: "#f59e0b" }} />;
  }
  return <Info className={cls} style={{ color: BRAND }} />;
}

// ─── Concordance helpers ──────────────────────────────────────────────────────
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<"all" | "peer">("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // ── Peer review notifications ──
  const { data: peerUnread = 0, refetch: refetchPeerCount } =
    trpc.notification.getUnreadCount.useQuery(undefined, { refetchInterval: 30_000 });

  const { data: peerNotifications = [], refetch: refetchPeerList } =
    trpc.notification.getMyNotifications.useQuery(undefined, { enabled: open });

  // ── Admin notifications (admin only) ──
  const { data: adminData, refetch: refetchAdminList } =
    trpc.adminNotifications.list.useQuery(
      { limit: 50, offset: 0 },
      { enabled: open && isAdmin }
    );
  const adminNotifications: AdminNotification[] = (adminData?.notifications ?? []) as AdminNotification[];
  const adminUnread = adminData?.unread ?? 0;

  // Total unread badge
  const totalUnread = isAdmin ? peerUnread + adminUnread : peerUnread;

  // ── Mutations ──
  const markPeerRead = trpc.notification.markRead.useMutation({
    onSuccess: () => { refetchPeerCount(); refetchPeerList(); },
  });
  const markAllPeerRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => { refetchPeerCount(); refetchPeerList(); },
  });
  const dismissPeer = trpc.notification.dismiss.useMutation({
    onSuccess: () => { refetchPeerCount(); refetchPeerList(); },
  });
  const markAdminRead = trpc.adminNotifications.markRead.useMutation({
    onSuccess: () => { refetchAdminList(); },
  });
  const markAllAdminRead = trpc.adminNotifications.markAllRead.useMutation({
    onSuccess: () => { refetchAdminList(); },
  });
  const deleteAdmin = trpc.adminNotifications.delete.useMutation({
    onSuccess: () => { refetchAdminList(); },
  });

  // ── Close on outside click ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentNotifs = adminTab === "peer" ? peerNotifications : adminNotifications;
  const currentUnread = adminTab === "peer" ? peerUnread : adminUnread;

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={bellRef}
        onClick={() => setOpen(v => !v)}
        className={cn(
          "relative p-2 rounded-lg transition-colors",
          open ? "bg-[#189aa1]/10 text-[#189aa1]" : "text-gray-500 hover:text-[#189aa1] hover:bg-[#189aa1]/5",
        )}
        aria-label={`Notifications${totalUnread > 0 ? ` (${totalUnread} unread)` : ""}`}
      >
        {totalUnread > 0 ? (
          <BellRing className="w-5 h-5" style={{ color: BRAND }} />
        ) : (
          <Bell className="w-5 h-5" />
        )}
        {totalUnread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1"
            style={{ background: BRAND }}
          >
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
          style={{ maxHeight: "560px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4" style={{ color: BRAND }} />
              <span className="font-semibold text-gray-800 text-sm">Notifications</span>
              {totalUnread > 0 && (
                <Badge
                  variant="secondary"
                  className="text-xs px-1.5 py-0"
                  style={{ background: `${BRAND}15`, color: BRAND }}
                >
                  {totalUnread} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {currentUnread > 0 && (
                <button
                  onClick={() => adminTab === "peer" ? markAllPeerRead.mutate() : markAllAdminRead.mutate()}
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

          {/* Tab bar (admin only) */}
          {isAdmin && (
            <div className="flex border-b border-gray-100 text-xs font-medium">
              <button
                onClick={() => setAdminTab("all")}
                className={cn(
                  "flex-1 py-2 transition-colors",
                  adminTab === "all"
                    ? "text-[#189aa1] border-b-2 border-[#189aa1] bg-[#189aa1]/3"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                All Admin
                {adminUnread > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full text-[10px] font-bold text-white px-1" style={{ background: BRAND }}>
                    {adminUnread}
                  </span>
                )}
              </button>
              <button
                onClick={() => setAdminTab("peer")}
                className={cn(
                  "flex-1 py-2 transition-colors",
                  adminTab === "peer"
                    ? "text-[#189aa1] border-b-2 border-[#189aa1] bg-[#189aa1]/3"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                Peer Review
                {peerUnread > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full text-[10px] font-bold text-white px-1" style={{ background: BRAND }}>
                    {peerUnread}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Notification List */}
          <div className="overflow-y-auto" style={{ maxHeight: "440px" }}>
            {currentNotifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: `${BRAND}10` }}>
                  <Bell className="w-6 h-6" style={{ color: BRAND }} />
                </div>
                <p className="text-sm font-medium text-gray-700">No notifications yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  {adminTab === "peer"
                    ? "You'll be notified when a Physician Peer Review is completed for your studies."
                    : "Admin notifications (enrollments, orders, form submissions) will appear here."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {adminTab === "peer"
                  ? (peerNotifications as PeerNotification[]).map(n => (
                    <div
                      key={n.id}
                      className={cn("px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer group", !n.isRead && "bg-[#189aa1]/3")}
                      onClick={() => !n.isRead && markPeerRead.mutate({ id: n.id })}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${BRAND}12` }}>
                          <Stethoscope className="w-4 h-4" style={{ color: BRAND }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn("text-xs font-semibold leading-snug line-clamp-2", n.isRead ? "text-gray-600" : "text-gray-800")}>{n.title}</p>
                            <button
                              onClick={e => { e.stopPropagation(); dismissPeer.mutate({ id: n.id }); }}
                              className="flex-shrink-0 p-0.5 rounded text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Dismiss"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          {n.payload?.concordanceScore != null && (
                            <div className={cn("inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold", getConcordanceBg(n.payload.concordanceScore))}>
                              <span className={getConcordanceColor(n.payload.concordanceScore)}>{n.payload.concordanceScore}% Concordance</span>
                            </div>
                          )}
                          {n.payload?.discordantFields && n.payload.discordantFields.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                              Discordant: {n.payload.discordantFields.slice(0, 3).join(", ")}
                              {n.payload.discordantFields.length > 3 && ` +${n.payload.discordantFields.length - 3} more`}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xs text-gray-400">
                              {n.payload?.reviewerName && `By ${n.payload.reviewerName} · `}
                              {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                            </span>
                            {!n.isRead && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: BRAND }} />}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                  : (adminNotifications as AdminNotification[]).map(n => (
                    <div
                      key={n.id}
                      className={cn("px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer group", !n.isRead && "bg-[#189aa1]/3")}
                      onClick={() => !n.isRead && markAdminRead.mutate({ id: n.id })}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${BRAND}12` }}>
                          <AdminNotifIcon source={n.source} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn("text-xs font-semibold leading-snug line-clamp-2", n.isRead ? "text-gray-600" : "text-gray-800")}>{n.title}</p>
                            <button
                              onClick={e => { e.stopPropagation(); deleteAdmin.mutate({ id: n.id }); }}
                              className="flex-shrink-0 p-0.5 rounded text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Dismiss"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{n.content}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xs text-gray-400">
                              <span className="inline-block bg-gray-100 text-gray-500 rounded px-1 py-0.5 text-[10px] mr-1">{n.source}</span>
                              {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                            </span>
                            {!n.isRead && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: BRAND }} />}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          {/* Footer */}
          {currentNotifs.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Showing last {currentNotifs.length} notification{currentNotifs.length !== 1 ? "s" : ""}
              </p>
              {adminTab === "all" && isAdmin && (
                <a href="/admin/notifications" className="text-xs text-[#189aa1] hover:underline flex items-center gap-0.5">
                  View all <ChevronRight className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
