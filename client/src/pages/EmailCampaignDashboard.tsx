/**
 * EmailCampaignDashboard — Admin dashboard for email campaigns
 *
 * Features:
 *  - Stats overview (total sent, avg open rate, avg click rate, unsubscribes)
 *  - Campaign list with per-row metrics and status
 *  - Per-campaign analytics drill-down (opens, clicks, unsubscribes over time)
 *  - Duplicate campaign
 *  - Sender profiles management tab
 *  - Unsubscribe list management
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Mail, Plus, BarChart2, Users, Send, Clock, CheckCircle, XCircle, StopCircle,
  RefreshCw, Trash2, Copy, Eye, TrendingUp, MousePointer, UserMinus,
  Shield, ChevronRight, ChevronLeft, Settings, UserCircle, Edit, Star, StarOff,
  AlertTriangle, Download, Zap, Code, List, Globe, MapPin, UserCheck, Link2,
  Newspaper, UserX, Search,
} from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmailCampaignEditor from "./EmailCampaignEditor";
import EmailListsTab from "./EmailListsTab";

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color || "#189aa1" + "20" }}>
            <span style={{ color: color || "#189aa1" }}>{icon}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    sent: { label: "Sent", className: "bg-green-100 text-green-700" },
    sending: { label: "Sending", className: "bg-blue-100 text-blue-700" },
    stopped: { label: "Stopped", className: "bg-orange-100 text-orange-700" },
    scheduled: { label: "Scheduled", className: "bg-yellow-100 text-yellow-700" },
    draft: { label: "Draft", className: "bg-gray-100 text-gray-600" },
    failed: { label: "Failed", className: "bg-red-100 text-red-700" },
  };
  const s = map[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.className}`}>{s.label}</span>;
}

// ─── Sender profile form ──────────────────────────────────────────────────────
function SenderProfileForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const createMutation = trpc.emailCampaign.saveSenderProfile.useMutation({
    onSuccess: () => {
      toast.success("Sender profile created");
      setName(""); setEmail(""); setReplyTo(""); setIsDefault(false);
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
      <p className="text-sm font-semibold text-gray-700">Add Sender Profile</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Display Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lara Williams" className="text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">From Email</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="lara@allaboutultrasound.com" type="email" className="text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Reply-To (optional)</label>
          <Input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="support@..." type="email" className="text-sm" />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded" />
            Set as default
          </label>
        </div>
      </div>
      <Button size="sm" onClick={() =>       createMutation.mutate({ name, email, replyTo: replyTo || undefined, isDefault })} disabled={!name.trim() || !email.trim() || createMutation.isPending} style={{ background: "#189aa1" }} className="text-white">
        <Plus className="w-4 h-4 mr-1.5" /> Add Profile
      </Button>
    </div>
  );
}

// ─── Analytics modal ──────────────────────────────────────────────────────────

// ─── Lead Capture Widget Form ──────────────────────────────────────────────────
function LeadCaptureWidgetForm({
  widget, emailLists, onSave, onCancel, saving,
}: {
  widget: any | null;
  emailLists: { id: number; name: string; subscriberCount?: number }[];
  onSave: (data: any) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(widget?.name ?? "");
  const [headline, setHeadline] = useState(widget?.headline ?? "Stay in the loop");
  const [subtext, setSubtext] = useState(widget?.subtext ?? "");
  const [emailPlaceholder, setEmailPlaceholder] = useState(widget?.emailPlaceholder ?? "Enter your email");
  const [namePlaceholder, setNamePlaceholder] = useState(widget?.namePlaceholder ?? "Your name (optional)");
  const [buttonText, setButtonText] = useState(widget?.buttonText ?? "Subscribe");
  const [buttonColor, setButtonColor] = useState(widget?.buttonColor ?? "#189aa1");
  const [buttonTextColor, setButtonTextColor] = useState(widget?.buttonTextColor ?? "#ffffff");
  const [bgColor, setBgColor] = useState(widget?.bgColor ?? "#f0fbfc");
  const [textColor, setTextColor] = useState(widget?.textColor ?? "#0e1e2e");
  const [borderRadius, setBorderRadius] = useState(widget?.borderRadius ?? 8);
  const [showNameField, setShowNameField] = useState(widget?.showNameField ?? false);
  const [listId, setListId] = useState<number | null>(widget?.listId ?? null);

  function handleSave() {
    onSave({ id: widget?.id, name, headline, subtext: subtext || undefined, emailPlaceholder, namePlaceholder, buttonText, buttonColor, buttonTextColor, bgColor, textColor, borderRadius, showNameField, listId });
  }

  return (
    <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
      <p className="text-sm font-semibold text-gray-700">{widget ? "Edit Widget" : "New Lead Capture Widget"}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs text-gray-500 mb-1 block">Widget Name (internal)</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Homepage lead form" className="text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-gray-500 mb-1 block">Headline</label>
          <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Stay in the loop" className="text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-gray-500 mb-1 block">Subtext (optional)</label>
          <Input value={subtext} onChange={(e) => setSubtext(e.target.value)} placeholder="Get the latest ultrasound tips..." className="text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Email Placeholder</label>
          <Input value={emailPlaceholder} onChange={(e) => setEmailPlaceholder(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Button Text</label>
          <Input value={buttonText} onChange={(e) => setButtonText(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Button Color</label>
          <input type="color" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="w-full h-8 rounded border cursor-pointer" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Button Text Color</label>
          <input type="color" value={buttonTextColor} onChange={(e) => setButtonTextColor(e.target.value)} className="w-full h-8 rounded border cursor-pointer" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Background Color</label>
          <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-full h-8 rounded border cursor-pointer" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Text Color</label>
          <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-full h-8 rounded border cursor-pointer" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Border Radius (px)</label>
          <Input type="number" min={0} max={50} value={borderRadius} onChange={(e) => setBorderRadius(Number(e.target.value))} className="text-sm" />
        </div>
        <div className="flex items-center gap-2 pt-4">
          <input type="checkbox" id="lcw-name" checked={showNameField} onChange={(e) => setShowNameField(e.target.checked)} className="rounded" />
          <label htmlFor="lcw-name" className="text-sm text-gray-600">Show name field</label>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-gray-500 mb-1 block">Subscribe to Email List</label>
          <select value={listId ?? ""} onChange={(e) => setListId(e.target.value ? Number(e.target.value) : null)} className="w-full border rounded px-2 py-1.5 text-sm bg-white">
            <option value="">None — don&apos;t subscribe to a specific list</option>
            {emailLists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.subscriberCount ?? 0})</option>)}
          </select>
          <p className="text-xs text-gray-400 mt-1">Submitters are always added to All Contacts regardless of this setting.</p>
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Preview</p>
        <div className="rounded-lg p-4 text-center max-w-sm" style={{ background: bgColor, color: textColor, borderRadius }}>
          <div className="font-semibold mb-1 text-sm">{headline || "Headline"}</div>
          {subtext && <div className="text-xs mb-2 opacity-80">{subtext}</div>}
          {showNameField && <div className="mb-1 border rounded px-2 py-1 text-xs text-gray-400 bg-white">{namePlaceholder}</div>}
          <div className="mb-2 border rounded px-2 py-1 text-xs text-gray-400 bg-white">{emailPlaceholder}</div>
          <div className="inline-block px-3 py-1 text-xs font-bold" style={{ background: buttonColor, color: buttonTextColor, borderRadius }}>{buttonText || "Subscribe"}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={!name.trim() || saving} style={{ background: "#189aa1" }} className="text-white">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {widget ? "Save Changes" : "Create Widget"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
function AnalyticsModal({ campaignId, subject, onClose, hideFinancials = false }: { campaignId: number; subject: string; onClose: () => void; hideFinancials?: boolean }) {
  const [activeTab, setActiveTab] = useState<"overview" | "recipients" | "geo" | "links">("overview");
  const [expandedLinkUrl, setExpandedLinkUrl] = useState<string | null>(null);
  const [recipientFilter, setRecipientFilter] = useState<"open" | "click" | "unsubscribe" | undefined>(undefined);
  const [segmentName, setSegmentName] = useState("");
  const [segmentEventType, setSegmentEventType] = useState<"open" | "click">("open");
  const [showSegmentForm, setShowSegmentForm] = useState(false);
  const utils = trpc.useUtils();

  const { data: analytics, isLoading } = trpc.emailCampaign.getCampaignAnalytics.useQuery({ campaignId });
  const { data: recipientsData, isLoading: recipientsLoading } = trpc.emailCampaign.getCampaignRecipients.useQuery(
    { campaignId, eventType: recipientFilter, limit: 200, offset: 0 },
    { enabled: activeTab === "recipients" }
  );
  const { data: geoData, isLoading: geoLoading } = trpc.emailCampaign.getCampaignGeo.useQuery(
    { campaignId },
    { enabled: activeTab === "geo" }
  );
  const { data: linkData, isLoading: linksLoading } = trpc.emailCampaign.getClickLinkBreakdown.useQuery(
    { campaignId },
    { enabled: activeTab === "links" }
  );
  const { refetch: fetchExport, isFetching: exportFetching } = trpc.emailCampaign.exportClickEvents.useQuery(
    { campaignId },
    { enabled: false }
  );

  const handleExportCsv = async () => {
    const result = await fetchExport();
    const rows = result.data?.rows ?? [];
    if (rows.length === 0) { toast.error("No click events to export."); return; }
    const header = ["Recipient Name", "Email", "Link URL", "Timestamp", "Country", "Region", "City"];
    const csvRows = rows.map((r) => [
      `"${(r.displayName ?? "").replace(/"/g, '""')}"`,
      `"${(r.email ?? "").replace(/"/g, '""')}"`,
      `"${(r.url ?? "").replace(/"/g, '""')}"`,
      `"${r.timestamp ? new Date(r.timestamp).toLocaleString() : ""}"`,
      `"${(r.country ?? "").replace(/"/g, '""')}"`,
      `"${(r.region ?? "").replace(/"/g, '""')}"`,
      `"${(r.city ?? "").replace(/"/g, '""')}"`,
    ].join(","));
    const csv = [header.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign-${campaignId}-clicks.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} click events`);
  };
  const createSegmentMutation = trpc.emailCampaign.createSegmentFromCampaign.useMutation({
    onSuccess: (data) => {
      toast.success(`Segment "${data.listName}" created with ${data.added} subscribers`);
      setShowSegmentForm(false);
      setSegmentName("");
      utils.emailCampaign.listEmailLists.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const eventBadgeColor = (et: string) => {
    if (et === "open") return "bg-blue-100 text-blue-700";
    if (et === "click") return "bg-green-100 text-green-700";
    if (et === "unsubscribe") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-700";
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <BarChart2 className="w-5 h-5 text-[#189aa1]" />
            <span className="truncate">{subject}</span>
          </DialogTitle>
          {/* Campaign summary banner */}
          {analytics && !isLoading && (
            <div className="mt-2 mb-1 rounded-lg border bg-gradient-to-r from-[#189aa1]/8 to-[#189aa1]/4 px-4 py-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold text-gray-900">{analytics.totalSent.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">Sent</div>
                  {analytics.sentAt && (
                    <div className="text-[10px] text-gray-400 mt-0.5">{new Date(analytics.sentAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>
                  )}
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-700">{analytics.uniqueOpens.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">Unique Opens</div>
                  <div className="text-[10px] text-blue-500 mt-0.5">{analytics.openRate}% rate</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-700">{analytics.uniqueClicks.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">Unique Clicks</div>
                  <div className="text-[10px] text-green-500 mt-0.5">{analytics.clickRate}% rate · {analytics.totalClicks.toLocaleString()} total</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-600">{analytics.totalUnsubscribes.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">Unsubscribes</div>
                  <div className="text-[10px] text-red-400 mt-0.5">{analytics.unsubscribeRate}% rate</div>
                </div>
              </div>
              {!hideFinancials && analytics.orders && analytics.orders.count > 0 && (
                <div className="mt-2 pt-2 border-t border-[#189aa1]/20 flex items-center gap-4 text-xs text-amber-700">
                  <span className="font-semibold">💰 {analytics.orders.count} attributed order{analytics.orders.count !== 1 ? "s" : ""}</span>
                  <span>${(analytics.orders.revenueCents / 100).toFixed(2)} revenue</span>
                </div>
              )}
            </div>
          )}
          {/* Tab bar */}
          <div className="flex gap-1 mt-3 border-b">
            {(["overview", "recipients", "geo", "links"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-[#189aa1] text-[#189aa1]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "overview" && <TrendingUp className="w-3.5 h-3.5 inline mr-1.5" />}
                {tab === "recipients" && <Users className="w-3.5 h-3.5 inline mr-1.5" />}
                {tab === "geo" && <Globe className="w-3.5 h-3.5 inline mr-1.5" />}
                {tab === "links" && <Link2 className="w-3.5 h-3.5 inline mr-1.5" />}
                {tab === "links" ? "Links" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-3">
          {/* ── OVERVIEW TAB ── */}
          {activeTab === "overview" && (
            isLoading ? (
              <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-[#189aa1]" /></div>
            ) : analytics ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-xl font-bold text-gray-900">{analytics.totalSent.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">Sent</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-xl font-bold text-blue-700">{analytics.uniqueOpens.toLocaleString()}</div>
                    <div className="text-xs text-blue-500 font-medium">{analytics.openRate}% open rate</div>
                    <div className="text-[10px] text-blue-400 mt-0.5">
                      {analytics.totalOpens > analytics.uniqueOpens
                        ? `${analytics.totalOpens.toLocaleString()} total · ${analytics.uniqueOpens.toLocaleString()} unique`
                        : "unique opens"}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-xl font-bold text-green-700">{analytics.uniqueClicks.toLocaleString()}</div>
                    <div className="text-xs text-green-500 font-medium">{analytics.clickRate}% click rate</div>
                    <div className="text-[10px] text-green-400 mt-0.5">
                      {analytics.totalClicks > analytics.uniqueClicks
                        ? `${analytics.totalClicks.toLocaleString()} total · ${analytics.uniqueClicks.toLocaleString()} unique`
                        : "unique clicks"}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-xl font-bold text-red-700">{analytics.totalUnsubscribes.toLocaleString()}</div>
                    <div className="text-xs text-red-500 font-medium">{analytics.unsubscribeRate}% unsub rate</div>
                    <div className="text-[10px] text-red-400 mt-0.5">unsubscribes</div>
                  </div>
                </div>

                {analytics.topLinks && analytics.topLinks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> TOP CLICKED LINKS</p>
                    <div className="space-y-1">
                      {analytics.topLinks.map((link: { url: string; clicks: number }, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 truncate flex-1 mr-3 hover:underline">{link.url}</a>
                          <span className="font-medium text-gray-700 shrink-0">{link.clicks} clicks</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!hideFinancials && analytics.orders && analytics.orders.count > 0 && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 border rounded-lg bg-amber-50">
                      <p className="text-xs text-amber-700 mb-1">Attributed Orders</p>
                      <p className="font-bold text-amber-900">{analytics.orders.count}</p>
                    </div>
                    <div className="p-3 border rounded-lg bg-amber-50">
                      <p className="text-xs text-amber-700 mb-1">Attributed Revenue</p>
                      <p className="font-bold text-amber-900">${(analytics.orders.revenueCents / 100).toFixed(2)}</p>
                    </div>
                  </div>
                )}

                {analytics.variantStats && Object.keys(analytics.variantStats).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">A/B VARIANT PERFORMANCE</p>
                    <div className="space-y-1">
                      {Object.entries(analytics.variantStats).map(([variant, stats]) => (
                        <div key={variant} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                          <span className="font-medium text-gray-700">Variant {variant}</span>
                          <span className="text-gray-500">{stats.opens} opens · {stats.clicks} clicks</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Create segment CTA */}
                <div className="border border-dashed border-[#189aa1]/40 rounded-lg p-4 bg-[#189aa1]/5">
                  <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5"><UserCheck className="w-4 h-4 text-[#189aa1]" /> Create Email List Segment</p>
                  {!showSegmentForm ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => { setSegmentEventType("open"); setShowSegmentForm(true); setSegmentName(`${subject} — Openers`); }}>
                        <Eye className="w-3.5 h-3.5 mr-1" /> From Openers ({analytics.uniqueOpens})
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => { setSegmentEventType("click"); setShowSegmentForm(true); setSegmentName(`${subject} — Clickers`); }}>
                        <MousePointer className="w-3.5 h-3.5 mr-1" /> From Clickers ({analytics.uniqueClicks})
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <Input
                        value={segmentName}
                        onChange={(e) => setSegmentName(e.target.value)}
                        placeholder="List name…"
                        className="text-sm h-8 flex-1"
                      />
                      <Button
                        size="sm"
                        style={{ background: "#189aa1" }}
                        className="text-white text-xs shrink-0"
                        disabled={!segmentName.trim() || createSegmentMutation.isPending}
                        onClick={() => createSegmentMutation.mutate({ campaignId, eventType: segmentEventType, listName: segmentName.trim() })}
                      >
                        {createSegmentMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Create"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs shrink-0" onClick={() => setShowSegmentForm(false)}>Cancel</Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No analytics data yet.</p>
            )
          )}

          {/* ── RECIPIENTS TAB ── */}
          {activeTab === "recipients" && (
            <div className="space-y-3">
              {/* Filter buttons */}
              <div className="flex gap-2 flex-wrap">
                {([undefined, "open", "click", "unsubscribe"] as const).map((f) => (
                  <button
                    key={String(f)}
                    onClick={() => setRecipientFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      recipientFilter === f
                        ? "bg-[#189aa1] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {f === undefined ? "All Events" : f.charAt(0).toUpperCase() + f.slice(1) + "s"}
                  </button>
                ))}
                {recipientsData && (
                  <span className="ml-auto text-xs text-gray-400 self-center">{recipientsData.total} events</span>
                )}
              </div>

              {recipientsLoading ? (
                <div className="flex items-center justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-[#189aa1]" /></div>
              ) : recipientsData && recipientsData.recipients.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Recipient</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Event</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Location</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {recipientsData.recipients.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900 truncate max-w-[180px]">{r.displayName}</div>
                            {r.email && r.email !== r.displayName && (
                              <div className="text-xs text-gray-400 truncate max-w-[180px]">{r.email}</div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${eventBadgeColor(r.eventType)}`}>
                              {r.eventType}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">
                            {r.city || r.region || r.country ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 shrink-0" />
                                {[r.city, r.region, r.country].filter(Boolean).join(", ")}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                            {r.timestamp ? new Date(r.timestamp).toLocaleString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No events recorded yet.</p>
                  <p className="text-xs mt-1">Events will appear here after recipients open or click.</p>
                </div>
              )}
            </div>
          )}

          {/* ── GEO TAB ── */}
          {activeTab === "geo" && (
            <div className="space-y-4">
              {geoLoading ? (
                <div className="flex items-center justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-[#189aa1]" /></div>
              ) : geoData && (geoData.byCountry.length > 0 || geoData.byRegion.length > 0) ? (
                <>
                  {geoData.byCountry.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> BY COUNTRY</p>
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Country</th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Unique Recipients</th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Total Events</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {geoData.byCountry.map((row, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-medium text-gray-900">{row.country}</td>
                                <td className="px-3 py-2 text-right text-gray-700">{row.uniqueRecipients}</td>
                                <td className="px-3 py-2 text-right text-gray-400">{row.totalEvents}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {geoData.byRegion.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> BY STATE / REGION</p>
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Region</th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Country</th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Unique Recipients</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {geoData.byRegion.slice(0, 50).map((row, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-medium text-gray-900">{row.region}</td>
                                <td className="px-3 py-2 text-gray-500">{row.country}</td>
                                <td className="px-3 py-2 text-right text-gray-700">{row.uniqueRecipients}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-10 text-gray-400">
                  <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No geo data yet.</p>
                  <p className="text-xs mt-1">Location data is captured from new opens and clicks going forward.</p>
                </div>
              )}
            </div>
          )}
          {/* ── LINKS TAB ── */}
          {activeTab === "links" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{linkData?.links.length ?? 0} unique link{(linkData?.links.length ?? 0) !== 1 ? "s" : ""} clicked · {linkData?.detail.length ?? 0} total clicks</p>
                <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={handleExportCsv} disabled={exportFetching}>
                  {exportFetching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Export CSV
                </Button>
              </div>
              {linksLoading ? (
                <div className="flex items-center justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-[#189aa1]" /></div>
              ) : linkData && linkData.links.length > 0 ? (
                <div className="space-y-2">
                  {linkData.links.map((link, i) => {
                    const isExpanded = expandedLinkUrl === link.url;
                    const clickers = linkData.detail.filter((d) => d.url === link.url);
                    return (
                      <div key={i} className="rounded-lg border overflow-hidden">
                        <button
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left"
                          onClick={() => setExpandedLinkUrl(isExpanded ? null : link.url)}
                        >
                          <Link2 className="w-3.5 h-3.5 text-[#189aa1] shrink-0" />
                          <span className="flex-1 text-xs text-blue-600 underline truncate min-w-0" title={link.url}>{link.url}</span>
                          <span className="shrink-0 text-xs font-semibold text-gray-700">{link.totalClicks} click{link.totalClicks !== 1 ? "s" : ""}</span>
                          <span className="shrink-0 text-xs text-gray-400">{link.uniqueClickers} unique</span>
                          <ChevronRight className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </button>
                        {isExpanded && (
                          <div className="border-t bg-gray-50">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left px-3 py-1.5 font-semibold text-gray-500">Recipient</th>
                                  <th className="text-left px-3 py-1.5 font-semibold text-gray-500">Email</th>
                                  <th className="text-left px-3 py-1.5 font-semibold text-gray-500">Location</th>
                                  <th className="text-left px-3 py-1.5 font-semibold text-gray-500">Time</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {clickers.map((c, j) => (
                                  <tr key={j} className="hover:bg-white">
                                    <td className="px-3 py-1.5 font-medium text-gray-900 truncate max-w-[140px]">{c.displayName}</td>
                                    <td className="px-3 py-1.5 text-gray-500 truncate max-w-[160px]">{c.email ?? "—"}</td>
                                    <td className="px-3 py-1.5 text-gray-400">{[c.city, c.region, c.country].filter(Boolean).join(", ") || "—"}</td>
                                    <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap">{c.timestamp ? new Date(c.timestamp).toLocaleString() : "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-400">
                  <MousePointer className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No click events recorded yet.</p>
                  <p className="text-xs mt-1">Link clicks will appear here after recipients click links in the email.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t pt-3">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Newsletter Subscribers Tab ──────────────────────────────────────────────
function NewsletterSubscribersTab() {
  const [search, setSearch] = useState("");
  const { data: subscribers, isLoading, isError, refetch } = trpc.newsletter.listSubscribers.useQuery();

  const filtered = useMemo(() => {
    if (!subscribers) return [];
    const q = search.toLowerCase().trim();
    if (!q) return subscribers;
    return subscribers.filter((s) =>
      s.email.toLowerCase().includes(q) ||
      (s.firstName ?? "").toLowerCase().includes(q) ||
      (s.lastName ?? "").toLowerCase().includes(q) ||
      (s.profession ?? "").toLowerCase().includes(q)
    );
  }, [subscribers, search]);

  const activeCount = (subscribers ?? []).filter((s) => s.isActive).length;
  const unsubCount = (subscribers ?? []).filter((s) => !s.isActive).length;

  // Profession breakdown
  const professionBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of (subscribers ?? [])) {
      if (!s.isActive) continue;
      const p = s.profession ?? "Not specified";
      map[p] = (map[p] ?? 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [subscribers]);

  // Recent sign-ups (last 10 active)
  const recent = useMemo(() => {
    return [...(subscribers ?? [])]
      .filter((s) => s.isActive)
      .sort((a, b) => (b.subscribedAt ?? 0) - (a.subscribedAt ?? 0))
      .slice(0, 10);
  }, [subscribers]);

  function exportCsv() {
    const rows = filtered;
    if (rows.length === 0) return;
    const header = ["Email", "First Name", "Last Name", "Profession", "Source", "Subscribed At", "Status"];
    const csvRows = rows.map((r) => [
      `"${(r.email ?? "").replace(/"/g, '""')}"`,
      `"${(r.firstName ?? "").replace(/"/g, '""')}"`,
      `"${(r.lastName ?? "").replace(/"/g, '""')}"`,
      `"${(r.profession ?? "").replace(/"/g, '""')}"`,
      `"${(r.source ?? "").replace(/"/g, '""')}"`,
      `"${r.subscribedAt ? new Date(r.subscribedAt).toLocaleDateString() : ""}"`,
      r.isActive ? "Active" : "Unsubscribed",
    ].join(","));
    const csv = [header.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-[#189aa1]" /></div>;
  if (isError) return (
    <div className="text-center py-16 text-gray-400">
      <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-red-400" />
      <p className="font-medium text-gray-700">Failed to load subscribers</p>
      <p className="text-sm mt-1 mb-4">There was a problem fetching the subscriber list.</p>
      <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-1.5" /> Retry</Button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Newspaper className="w-5 h-5" />} label="Total Subscribers" value={(subscribers ?? []).length.toLocaleString()} />
        <StatCard icon={<UserCheck className="w-5 h-5" />} label="Active" value={activeCount.toLocaleString()} sub="currently subscribed" color="#10b981" />
        <StatCard icon={<UserX className="w-5 h-5" />} label="Unsubscribed" value={unsubCount.toLocaleString()} sub="opted out" color="#ef4444" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Recent Sign-ups" value={recent.length} sub="most recent 10" color="#3b82f6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Profession breakdown */}
        <div className="border rounded-xl bg-white shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Profession Breakdown</p>
          {professionBreakdown.length === 0 ? (
            <p className="text-xs text-gray-400">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {professionBreakdown.map(([profession, count]) => (
                <div key={profession}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-gray-700 truncate max-w-[160px]">{profession}</span>
                    <span className="font-semibold text-gray-900 ml-2">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.round((count / activeCount) * 100)}%`, background: "#189aa1" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent sign-ups */}
        <div className="lg:col-span-2 border rounded-xl bg-white shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Recent Sign-ups</p>
          {recent.length === 0 ? (
            <p className="text-xs text-gray-400">No subscribers yet.</p>
          ) : (
            <div className="space-y-2">
              {recent.map((s) => (
                <div key={s.id} className="flex items-center gap-3 text-sm">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "#189aa1" }}>
                    {(s.firstName?.[0] ?? s.email[0]).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {[s.firstName, s.lastName].filter(Boolean).join(" ") || s.email}
                    </div>
                    {(s.firstName || s.lastName) && <div className="text-xs text-gray-400 truncate">{s.email}</div>}
                  </div>
                  {s.profession && <span className="text-xs text-gray-500 shrink-0">{s.profession}</span>}
                  <span className="text-xs text-gray-400 shrink-0">{s.subscribedAt ? new Date(s.subscribedAt).toLocaleDateString() : "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Full subscriber table */}
      <div className="border rounded-xl bg-white shadow-sm">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subscribers…"
                className="pl-8 pr-3 py-1.5 text-sm border rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">EMAIL</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">NAME</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">PROFESSION</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">SOURCE</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">SUBSCRIBED</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">No subscribers found.</td></tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-900 font-medium">{s.email}</td>
                    <td className="px-4 py-2.5 text-gray-600">{[s.firstName, s.lastName].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-500">{s.profession || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{s.source || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{s.subscribedAt ? new Date(s.subscribedAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-2.5">
                      {s.isActive
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Unsubscribed</span>
                      }
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function EmailCampaignDashboard() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const [courseAudienceId] = useState(() => {
    const value = Number(new URLSearchParams(window.location.search).get("courseId"));
    return Number.isInteger(value) && value > 0 ? value : null;
  });
  const [cohortGroupAudienceId] = useState(() => {
    const value = Number(new URLSearchParams(window.location.search).get("cohortGroupId"));
    return Number.isInteger(value) && value > 0 ? value : null;
  });
  const [workshopInstanceAudienceId] = useState(() => {
    const value = Number(new URLSearchParams(window.location.search).get("workshopInstanceId"));
    return Number.isInteger(value) && value > 0 ? value : null;
  });
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState("campaigns");
  const [showEditor, setShowEditor] = useState(false);
  const [editCampaignId, setEditCampaignId] = useState<number | undefined>();
  const [analyticsId, setAnalyticsId] = useState<number | null>(null);
  const [analyticsSubject, setAnalyticsSubject] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingWidget, setEditingWidget] = useState<any | null>(null);
  const [showWidgetForm, setShowWidgetForm] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: campaigns, refetch: refetchCampaigns, isLoading: campaignsLoading } = trpc.emailCampaign.listCampaigns.useQuery(undefined, { enabled: !!user });
  const { data: senderProfiles, refetch: refetchProfiles } = trpc.emailCampaign.listSenderProfiles.useQuery(undefined, { enabled: !!user });
  const { data: emailLists } = trpc.emailCampaign.listEmailLists.useQuery(undefined, { enabled: !!user });
  const { data: leadCaptureWidgets, refetch: refetchWidgets } = trpc.emailCampaign.listLeadCaptureWidgets.useQuery(undefined, { enabled: !!user });

  // ── Mutations ───────────────────────────────────────────────────────────────
  const resendMutation = trpc.emailCampaign.resendCampaign.useMutation({
    onSuccess: (data) => { toast.success(`Campaign resent to ${data.recipientCount} recipients`); refetchCampaigns(); },
    onError: (e) => toast.error(e.message),
  });
  const stopMutation = trpc.emailCampaign.stopCampaign.useMutation({
    onSuccess: () => { toast.success("Campaign stopped — no further emails will be sent."); refetchCampaigns(); },
    onError: (e) => toast.error(e.message),
  });
  const duplicateMutation = trpc.emailCampaign.duplicateCampaign.useMutation({
    onSuccess: () => { toast.success("Campaign duplicated"); refetchCampaigns(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteSenderMutation = trpc.emailCampaign.deleteSenderProfile.useMutation({
    onSuccess: () => { toast.success("Sender profile deleted"); refetchProfiles(); },
    onError: (e) => toast.error(e.message),
  });

  const setDefaultSenderMutation = trpc.emailCampaign.saveSenderProfile.useMutation({
    onSuccess: () => { toast.success("Default sender updated"); refetchProfiles(); },
    onError: (e) => toast.error(e.message),
  });
  const saveWidgetMutation = trpc.emailCampaign.saveLeadCaptureWidget.useMutation({
    onSuccess: () => { toast.success("Widget saved"); refetchWidgets(); setShowWidgetForm(false); setEditingWidget(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteWidgetMutation = trpc.emailCampaign.deleteLeadCaptureWidget.useMutation({
    onSuccess: () => { toast.success("Widget deleted"); refetchWidgets(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteCampaignMutation = trpc.emailCampaign.deleteCampaign.useMutation({
    onSuccess: () => { toast.success("Campaign deleted"); setDeleteConfirmId(null); refetchCampaigns(); },
    onError: (e) => { toast.error(e.message); setDeleteConfirmId(null); },
  });

  // ── Auth guards ─────────────────────────────────────────────────────────────
  if (loading) return <Layout><div className="container py-12 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-[#189aa1]" /></div></Layout>;
  if (!isAuthenticated || !user) return <Layout><div className="container py-12 text-center text-gray-500">Please log in.</div></Layout>;
  const isRestrictedManager = (user.appRoles ?? []).includes("platform_manager")
    && !(user.appRoles ?? []).some((role) => role === "platform_admin" || role === "platform_owner")
    && user.role !== "admin";
  const isAdmin = user.role === "admin" || (user.appRoles ?? []).some((role) => ["platform_admin", "platform_owner", "platform_manager"].includes(role));
  if (!isAdmin) return <Layout><div className="container py-12 text-center"><Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Admin access required.</p></div></Layout>;

  // If editor is open, show it full-page
  if (showEditor) {
    const initialAudienceFilter = courseAudienceId
      ? { ...DEFAULT_AUDIENCE_FILTER, activeAccessCourseIds: [courseAudienceId], userStatus: "active" }
      : cohortGroupAudienceId
        ? { ...DEFAULT_AUDIENCE_FILTER, inCohortGroupIds: [cohortGroupAudienceId], userStatus: "active" }
        : workshopInstanceAudienceId
          ? { ...DEFAULT_AUDIENCE_FILTER, workshopInstanceIds: [workshopInstanceAudienceId], userStatus: "active" }
          : undefined;
    return <EmailCampaignEditor campaignId={editCampaignId} initialAudienceFilter={initialAudienceFilter} onClose={() => { setShowEditor(false); setEditCampaignId(undefined); refetchCampaigns(); }} />;
  }

  // ── Derived stats ────────────────────────────────────────────────────────────
  const sentCampaigns = (campaigns ?? []).filter((c) => c.status === "sent");
  const totalSent = sentCampaigns.reduce((sum, c) => sum + (c.recipientCount ?? 0), 0);
  const avgOpenRate = sentCampaigns.length > 0
    ? Math.round(sentCampaigns.reduce((sum, c) => sum + (c.openRate ?? 0), 0) / sentCampaigns.length)
    : 0;
  const avgClickRate = sentCampaigns.length > 0
    ? Math.round(sentCampaigns.reduce((sum, c) => sum + (c.clickRate ?? 0), 0) / sentCampaigns.length)
    : 0;
  const totalUnsubscribes = sentCampaigns.reduce((sum, c) => sum + (c.unsubscribeCount ?? 0), 0);

  const filteredCampaigns = (campaigns ?? []).filter((c) =>
    !searchQuery || c.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="container py-8 max-w-7xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-5">
          <button onClick={() => navigate("/platform-admin")} className="flex items-center gap-1 hover:text-[#189aa1] transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
            Platform Admin
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          <span className="text-gray-700 font-medium">Email Campaigns</span>
        </nav>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#189aa1" }}>
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Merriweather, serif" }}>Email Campaigns</h1>
              <p className="text-sm text-gray-500">Manage campaigns, templates, and sender profiles</p>
            </div>
          </div>
          <Button onClick={() => { setEditCampaignId(undefined); setShowEditor(true); }} style={{ background: "#189aa1" }} className="text-white">
            <Plus className="w-4 h-4 mr-1.5" /> New Campaign
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<Send className="w-5 h-5" />} label="Total Sent" value={totalSent.toLocaleString()} sub={`${sentCampaigns.length} campaigns`} />
          <StatCard icon={<Eye className="w-5 h-5" />} label="Avg Open Rate" value={`${avgOpenRate}%`} sub="across all sent campaigns" color="#3b82f6" />
          <StatCard icon={<MousePointer className="w-5 h-5" />} label="Avg Click Rate" value={`${avgClickRate}%`} sub="across all sent campaigns" color="#10b981" />
          <StatCard icon={<UserMinus className="w-5 h-5" />} label="Unsubscribes" value={totalUnsubscribes.toLocaleString()} sub="total unsubscribes" color="#ef4444" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="campaigns" className="flex items-center gap-1.5">
              <Mail className="w-4 h-4" /> Campaigns
              {campaigns && <Badge variant="secondary" className="ml-1 text-xs">{campaigns.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="senders" className="flex items-center gap-1.5">
              <UserCircle className="w-4 h-4" /> Sender Profiles
              {senderProfiles && <Badge variant="secondary" className="ml-1 text-xs">{senderProfiles.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="widgets" className="flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> Lead Capture Widgets
              {leadCaptureWidgets && <Badge variant="secondary" className="ml-1 text-xs">{leadCaptureWidgets.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="lists" className="flex items-center gap-1.5">
              <List className="w-4 h-4" /> Email Lists
            </TabsTrigger>
            <TabsTrigger value="newsletter" className="flex items-center gap-1.5">
              <Newspaper className="w-4 h-4" /> Newsletter Subscribers
            </TabsTrigger>
          </TabsList>

          {/* ── Campaigns tab ─────────────────────────────────────────────── */}
          <TabsContent value="campaigns">
            <div className="flex items-center gap-3 mb-4">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search campaigns…"
                className="max-w-xs text-sm"
              />
              <Button variant="outline" size="sm" onClick={() => refetchCampaigns()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            {campaignsLoading ? (
              <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-[#189aa1]" /></div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No campaigns yet</p>
                <p className="text-sm mt-1">Click "New Campaign" to get started</p>
              </div>
            ) : (
              <div className="border rounded-xl overflow-x-auto bg-white shadow-sm">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">CAMPAIGN</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">STATUS</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">SENT</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">OPENS</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">CLICKS</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">UNSUBS</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">DATE</th>
                      <th className="sticky right-0 bg-gray-50 px-3 py-3 text-xs font-semibold text-gray-500 border-l border-gray-100"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCampaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td
                          className="px-4 py-3 cursor-pointer"
                          onClick={() => {
                            if (c.status === "draft" || c.status === "scheduled") {
                              setEditCampaignId(c.id); setShowEditor(true);
                            } else if (c.status === "sent") {
                              setAnalyticsId(c.id); setAnalyticsSubject(c.subject);
                            }
                          }}
                        >
                          <div className="font-medium text-gray-900 truncate max-w-xs hover:text-[#189aa1] transition-colors">{c.subject}</div>
                          {c.previewText && <div className="text-xs text-gray-400 truncate max-w-xs">{c.previewText}</div>}
                          <div className="text-[10px] text-gray-300 mt-0.5 md:hidden">
                            {c.status === "draft" || c.status === "scheduled" ? "Tap to edit" : "Tap for analytics"}
                          </div>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-3 text-right text-gray-700">{(c.recipientCount ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          {c.status === "sent" ? (
                            <span className="text-blue-600 font-medium">{c.openRate ?? 0}%</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {c.status === "sent" ? (
                            <span className="text-green-600 font-medium">{c.clickRate ?? 0}%</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {c.status === "sent" ? (
                            <span className="text-red-500">{c.unsubscribeCount ?? 0}</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-400">
                          {c.sentAt ? new Date(c.sentAt).toLocaleDateString() : c.scheduledAt ? `📅 ${new Date(c.scheduledAt).toLocaleDateString()}` : "—"}
                        </td>
                        <td className="sticky right-0 bg-white px-3 py-3 border-l border-gray-100">
                          <div className="flex items-center justify-end gap-1">
                            {c.status === "sent" && (
                              <button onClick={() => { setAnalyticsId(c.id); setAnalyticsSubject(c.subject); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-[#189aa1]" title="Analytics">
                                <BarChart2 className="w-4 h-4" />
                              </button>
                            )}
                            {!isRestrictedManager && c.status === "sending" && (
                              <button
                                onClick={() => { if (window.confirm("Stop this campaign? Emails already sent will not be recalled.")) stopMutation.mutate({ id: c.id }); }}
                                className="p-1.5 rounded hover:bg-red-50 text-orange-500 hover:text-red-600"
                                title="Stop Sending"
                                disabled={stopMutation.isPending}
                              >
                                <StopCircle className="w-4 h-4" />
                              </button>
                            )}
                            {(c.status === "draft" || c.status === "scheduled") && (
                              <button onClick={() => { setEditCampaignId(c.id); setShowEditor(true); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-[#189aa1]" title="Edit">
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => duplicateMutation.mutate({ id: c.id })} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-[#189aa1]" title="Duplicate">
                              <Copy className="w-4 h-4" />
                            </button>
                            {!isRestrictedManager && (c.status === "sent" || c.status === "failed") && (
                              <button
                                onClick={() => { if (window.confirm(`Resend "${c.subject}" to all matching recipients?`)) resendMutation.mutate({ id: c.id }); }}
                                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-[#189aa1]"
                                title="Resend Campaign"
                                disabled={resendMutation.isPending}
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}
                            {!isRestrictedManager && (
                              <button onClick={() => setDeleteConfirmId(c.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ── Sender profiles tab ───────────────────────────────────────── */}
          <TabsContent value="senders">
            <div className="space-y-4">
              <SenderProfileForm onSaved={refetchProfiles} />

              {(!senderProfiles || senderProfiles.length === 0) ? (
                <div className="text-center py-8 text-gray-400 text-sm">No sender profiles yet. Add one above.</div>
              ) : (
                <div className="border rounded-xl overflow-x-auto bg-white shadow-sm">
                  <table className="w-full min-w-[500px] text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">NAME</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">EMAIL</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">REPLY-TO</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">DEFAULT</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {senderProfiles.map((sp) => (
                        <tr key={sp.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{sp.name}</td>
                          <td className="px-4 py-3 text-gray-600">{sp.email}</td>
                          <td className="px-4 py-3 text-gray-400">{sp.replyTo || "—"}</td>
                          <td className="px-4 py-3">
                            {sp.isDefault ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#189aa1]"><Star className="w-3 h-3" /> Default</span>
                            ) : (
                              <button               onClick={() => setDefaultSenderMutation.mutate({ id: sp.id, name: sp.name, email: sp.email, replyTo: sp.replyTo || undefined, isDefault: true })} className="text-xs text-gray-400 hover:text-[#189aa1] flex items-center gap-1">
                                <StarOff className="w-3 h-3" /> Set default
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {!isRestrictedManager && (
                              <button onClick={() => deleteSenderMutation.mutate({ id: sp.id })} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                <p className="font-medium mb-1">📧 About Sender Profiles</p>
                <p className="text-xs text-blue-600">Sender profiles let you send campaigns from different names and email addresses (e.g. "Lara Williams" for course emails, "Support Team" for billing). Make sure each email address is verified in your SendGrid account.</p>
              </div>
            </div>
          </TabsContent>

          {/* ── Lead Capture Widgets tab ────────────────────────────────────────────── */}
          <TabsContent value="widgets">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Create embeddable lead capture forms that subscribe visitors to your email lists.</p>
                <Button onClick={() => { setEditingWidget(null); setShowWidgetForm(true); }} style={{ background: "#189aa1" }} className="text-white" size="sm">
                  <Plus className="w-4 h-4 mr-1" /> New Widget
                </Button>
              </div>

              {showWidgetForm && (
                <LeadCaptureWidgetForm
                  widget={editingWidget}
                  emailLists={emailLists ?? []}
                  onSave={(data) => saveWidgetMutation.mutate(data)}
                  onCancel={() => { setShowWidgetForm(false); setEditingWidget(null); }}
                  saving={saveWidgetMutation.isPending}
                />
              )}

              {(!leadCaptureWidgets || leadCaptureWidgets.length === 0) ? (
                <div className="text-center py-8 text-gray-400 text-sm">No lead capture widgets yet. Create one above.</div>
              ) : (
                <div className="space-y-3">
                  {leadCaptureWidgets.map((w) => (
                    <div key={w.id} className="border rounded-xl bg-white shadow-sm p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900 text-sm">{w.name}</span>
                            {w.listId && emailLists?.find(l => l.id === w.listId) && (
                              <Badge variant="secondary" className="text-xs">
                                <List className="w-3 h-3 mr-1" />
                                {emailLists.find(l => l.id === w.listId)?.name}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mb-2">{w.headline}</p>
                          {/* Preview */}
                          <div className="rounded-lg p-3 text-center text-xs max-w-xs" style={{ background: w.bgColor, color: w.textColor }}>
                            <div className="font-semibold mb-1" style={{ color: w.textColor }}>{w.headline}</div>
                            {w.subtext && <div className="mb-2 text-xs opacity-80">{w.subtext}</div>}
                            {w.showNameField && <div className="mb-1 border rounded px-2 py-1 text-xs text-gray-400 bg-white">{w.namePlaceholder}</div>}
                            <div className="mb-2 border rounded px-2 py-1 text-xs text-gray-400 bg-white">{w.emailPlaceholder}</div>
                            <div className="inline-block px-3 py-1 rounded text-xs font-bold" style={{ background: w.buttonColor, color: w.buttonTextColor, borderRadius: w.borderRadius }}>{w.buttonText}</div>
                          </div>
                          {/* Embed code */}
                          <div className="mt-3">
                            <p className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><Code className="w-3 h-3" /> Embed Code</p>
                            <pre className="text-xs bg-gray-50 border rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{`<script src="${window.location.origin}/api/widget/${w.id}.js"></script>\n<div id="lcw-${w.id}"></div>`}</pre>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button variant="outline" size="sm" onClick={() => { setEditingWidget(w); setShowWidgetForm(true); }}><Edit className="w-4 h-4" /></Button>
                          {!isRestrictedManager && (
                            <Button variant="outline" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => deleteWidgetMutation.mutate({ id: w.id })}><Trash2 className="w-4 h-4" /></Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                <p className="font-medium mb-1">📌 About Lead Capture Widgets</p>
                <p className="text-xs text-blue-600">Embed the script tag on any external website or landing page. When a visitor submits their email, they are automatically added to the selected email list and to your All Contacts list.</p>
              </div>
            </div>
          </TabsContent>

          {/* ── Email Lists tab ─────────────────────────────────────────────── */}
          <TabsContent value="lists">
            <EmailListsTab />
          </TabsContent>

          {/* ── Newsletter Subscribers tab ─────────────────────────────────── */}
          <TabsContent value="newsletter">
            <NewsletterSubscribersTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Analytics modal */}
      {analyticsId !== null && (
        <AnalyticsModal
          campaignId={analyticsId}
          subject={analyticsSubject}
          onClose={() => { setAnalyticsId(null); setAnalyticsSubject(""); }}
          hideFinancials={isRestrictedManager}
        />
      )}

      {/* Delete campaign confirm dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" /> Delete Campaign
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            {(() => {
              const c = campaigns?.find((x) => x.id === deleteConfirmId);
              return c?.status === "sent"
                ? `This campaign was already sent to ${c.recipientCount ?? 0} recipient${(c.recipientCount ?? 0) !== 1 ? "s" : ""}. Deleting it will remove all analytics data. Are you sure?`
                : "Are you sure you want to delete this campaign? This cannot be undone.";
            })()}
          </p>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteConfirmId !== null && deleteCampaignMutation.mutate({ id: deleteConfirmId })}
              disabled={deleteCampaignMutation.isPending}
              className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
            >
              {deleteCampaignMutation.isPending ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
