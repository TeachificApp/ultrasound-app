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
import { useState } from "react";
import { useLocation } from "wouter";
import {
  Mail, Plus, BarChart2, Users, Send, Clock, CheckCircle, XCircle,
  RefreshCw, Trash2, Copy, Eye, TrendingUp, MousePointer, UserMinus,
  Shield, ChevronRight, Settings, UserCircle, Edit, Star, StarOff,
  AlertTriangle, Download,
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
function AnalyticsModal({ campaignId, subject, onClose }: { campaignId: number; subject: string; onClose: () => void }) {
  const { data: analytics, isLoading } = trpc.emailCampaign.getCampaignAnalytics.useQuery({ campaignId });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-[#189aa1]" /> Analytics: {subject}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-[#189aa1]" /></div>
        ) : analytics ? (
          <div className="space-y-4 py-2">
            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xl font-bold text-gray-900">{analytics.totalSent.toLocaleString()}</div>
                <div className="text-xs text-gray-500">Sent</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-xl font-bold text-blue-700">{analytics.totalOpens.toLocaleString()}</div>
                <div className="text-xs text-blue-500">Opens ({analytics.openRate}%)</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-700">{analytics.totalClicks.toLocaleString()}</div>
                <div className="text-xs text-green-500">Clicks ({analytics.clickRate}%)</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-xl font-bold text-red-700">{analytics.totalUnsubscribes.toLocaleString()}</div>
                <div className="text-xs text-red-500">Unsubscribes ({analytics.unsubscribeRate}%)</div>
              </div>
            </div>

            {/* Unique vs total */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 border rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Unique Opens</p>
                <p className="font-bold text-gray-900">{analytics.uniqueOpens.toLocaleString()}</p>
              </div>
              <div className="p-3 border rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Unique Clicks</p>
                <p className="font-bold text-gray-900">{analytics.uniqueClicks.toLocaleString()}</p>
              </div>
            </div>

            {/* Top clicked links */}
            {analytics.topLinks && analytics.topLinks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">TOP CLICKED LINKS</p>
                <div className="space-y-1">
                  {analytics.topLinks.map((link: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                      <span className="text-blue-600 truncate flex-1 mr-3">{link.url}</span>
                      <span className="font-medium text-gray-700 shrink-0">{link.clicks} clicks</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">No analytics data yet.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function EmailCampaignDashboard() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState("campaigns");
  const [showEditor, setShowEditor] = useState(false);
  const [editCampaignId, setEditCampaignId] = useState<number | undefined>();
  const [analyticsId, setAnalyticsId] = useState<number | null>(null);
  const [analyticsSubject, setAnalyticsSubject] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: campaigns, refetch: refetchCampaigns, isLoading: campaignsLoading } = trpc.emailCampaign.listCampaigns.useQuery(undefined, { enabled: !!user });
  const { data: senderProfiles, refetch: refetchProfiles } = trpc.emailCampaign.listSenderProfiles.useQuery(undefined, { enabled: !!user });

  // ── Mutations ───────────────────────────────────────────────────────────────
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

  // ── Auth guards ─────────────────────────────────────────────────────────────
  if (loading) return <Layout><div className="container py-12 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-[#189aa1]" /></div></Layout>;
  if (!isAuthenticated || !user) return <Layout><div className="container py-12 text-center text-gray-500">Please log in.</div></Layout>;
  const isAdmin = user.role === "admin" || (user.appRoles ?? []).includes("platform_admin");
  if (!isAdmin) return <Layout><div className="container py-12 text-center"><Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Admin access required.</p></div></Layout>;

  // If editor is open, show it full-page
  if (showEditor) {
    return <EmailCampaignEditor campaignId={editCampaignId} onClose={() => { setShowEditor(false); setEditCampaignId(undefined); refetchCampaigns(); }} />;
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
              <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">CAMPAIGN</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">STATUS</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">SENT</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">OPENS</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">CLICKS</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">UNSUBS</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">DATE</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCampaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 truncate max-w-xs">{c.subject}</div>
                          {c.previewText && <div className="text-xs text-gray-400 truncate max-w-xs">{c.previewText}</div>}
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
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {c.status === "sent" && (
                              <button onClick={() => { setAnalyticsId(c.id); setAnalyticsSubject(c.subject); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-[#189aa1]" title="Analytics">
                                <BarChart2 className="w-4 h-4" />
                              </button>
                            )}
                            {(c.status === "draft" || c.status === "scheduled") && (
                              <button onClick={() => { setEditCampaignId(c.id); setShowEditor(true); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-[#189aa1]" title="Edit">
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => duplicateMutation.mutate({ campaignId: c.id })} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-[#189aa1]" title="Duplicate">
                              <Copy className="w-4 h-4" />
                            </button>
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
                <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-sm">
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
                            <button onClick={() => deleteSenderMutation.mutate({ id: sp.id })} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
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
        </Tabs>
      </div>

      {/* Analytics modal */}
      {analyticsId !== null && (
        <AnalyticsModal
          campaignId={analyticsId}
          subject={analyticsSubject}
          onClose={() => { setAnalyticsId(null); setAnalyticsSubject(""); }}
        />
      )}
    </Layout>
  );
}
