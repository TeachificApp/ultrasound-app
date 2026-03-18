/**
 * Thinkific Webhook Admin Page
 *
 * Shows the webhook event log, stats, a test tool, and setup instructions.
 * Admin-only — accessible at /admin/thinkific-webhook.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Webhook, RefreshCw, Send, Copy, CheckCircle2, XCircle, Clock,
  AlertTriangle, Info, ExternalLink, Shield,
} from "lucide-react";
import { toast } from "sonner";

// ─── Outcome badge ────────────────────────────────────────────────────────────
function OutcomeBadge({ outcome }: { outcome: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    granted:         { label: "Granted",         className: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
    revoked:         { label: "Revoked",          className: "bg-red-100 text-red-700 border-red-200",             icon: <XCircle className="w-3 h-3" /> },
    pending_created: { label: "Pending Created",  className: "bg-blue-100 text-blue-700 border-blue-200",          icon: <Clock className="w-3 h-3" /> },
    ignored:         { label: "Ignored",          className: "bg-gray-100 text-gray-500 border-gray-200",          icon: <Info className="w-3 h-3" /> },
    error:           { label: "Error",            className: "bg-orange-100 text-orange-700 border-orange-200",    icon: <AlertTriangle className="w-3 h-3" /> },
  };
  const cfg = map[outcome] ?? { label: outcome, className: "bg-gray-100 text-gray-500 border-gray-200", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-1 shadow-sm">
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ThinkificWebhookAdmin() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = (user as any)?.role === "admin";

  const [testEmail, setTestEmail] = useState("");
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${window.location.origin}/api/webhooks/thinkific`;

  const { data: events = [], isLoading, refetch } = trpc.premium.adminGetWebhookEvents.useQuery(
    { limit: 100 },
    { enabled: isAdmin, refetchInterval: 30_000 }
  );

  const testMutation = trpc.premium.adminTestWebhook.useMutation({
    onSuccess: (result) => {
      toast.success(`Test webhook sent — ${result.message}`);
      refetch();
    },
    onError: (err) => toast.error(`Test failed: ${err.message}`),
  });

  if (!isAdmin) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">Admin Access Required</h2>
          <p className="text-gray-500 text-sm mb-4">You need admin privileges to view this page.</p>
          <Button variant="outline" onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </Layout>
    );
  }

  // Compute stats
  const stats = {
    total:          events.length,
    granted:        events.filter(e => e.outcome === "granted").length,
    pending:        events.filter(e => e.outcome === "pending_created").length,
    revoked:        events.filter(e => e.outcome === "revoked").length,
    errors:         events.filter(e => e.outcome === "error").length,
    ignored:        events.filter(e => e.outcome === "ignored").length,
    filtered:       events.filter(e => e.outcome === "filtered").length,
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("Webhook URL copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Layout>
      <div className="container py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "#189aa115" }}>
            <Webhook className="w-5 h-5" style={{ color: "#189aa1" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
              Thinkific Webhook
            </h1>
            <p className="text-sm text-gray-500">Monitor premium purchase events from Thinkific</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto gap-2"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Setup card */}
        <Card className="mb-6 border-[#189aa1]/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4 text-[#189aa1]" />
              Webhook Setup
            </CardTitle>
            <CardDescription>
              Configure this URL in your Thinkific admin to receive purchase events automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1.5">Webhook URL</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-800 truncate">
                  {webhookUrl}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 flex-shrink-0">
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#f0fbfc] rounded-lg p-3">
                <div className="text-xs font-semibold text-[#189aa1] mb-2">Subscribe to These Events Only</div>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> order.created</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> subscription.cancelled</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> subscription.activated</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> enrollment.created</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> enrollment.updated</li>
                </ul>
                <p className="text-[10px] text-gray-400 mt-2">All other event types are immediately filtered (logged but not processed).</p>
              </div>
              <div className="bg-[#f0fbfc] rounded-lg p-3">
                <div className="text-xs font-semibold text-[#189aa1] mb-1">Where to Configure</div>
                <p className="text-xs text-gray-600">Thinkific Admin → Settings → Webhooks → Add Webhook</p>
                <a
                  href="https://member.allaboutultrasound.com/admin/settings/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#189aa1] font-medium mt-1 hover:underline"
                >
                  Open Thinkific Webhooks <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Filter Rules */}
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
              <Shield className="w-4 h-4 text-amber-600" />
              Active Filter Rules
            </CardTitle>
            <CardDescription className="text-amber-700 text-xs">
              The webhook handler applies two gates before processing any event. Events that fail either gate are logged with outcome <strong>filtered</strong> and no database changes are made.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-amber-800 mb-2">Gate 1 — Allowed Event Types</p>
                <div className="space-y-1">
                  {["order.created", "subscription.cancelled", "subscription.activated", "enrollment.created", "enrollment.updated"].map(e => (
                    <div key={e} className="flex items-center gap-2 text-xs text-amber-900">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                      <code className="bg-white/60 px-1.5 py-0.5 rounded font-mono">{e}</code>
                    </div>
                  ))}
                  <p className="text-[10px] text-amber-600 mt-1">All other resource/action combinations → filtered immediately</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-800 mb-2">Gate 2 — Relevant Product Names</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Premium App Access</p>
                    <div className="flex flex-wrap gap-1">
                      {["iHeartEcho App - Premium Access", "iHeartEcho Premium Access"].map(p => (
                        <span key={p} className="inline-block bg-white/60 text-amber-900 text-[10px] font-mono px-1.5 py-0.5 rounded border border-amber-200">{p}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">DIY Accreditation Memberships</p>
                    <div className="flex flex-wrap gap-1">
                      {["DIY Accreditation", "Accreditation Membership", "Lab Director", "Lab Admin"].map(p => (
                        <span key={p} className="inline-block bg-white/60 text-amber-900 text-[10px] font-mono px-1.5 py-0.5 rounded border border-amber-200">{p}</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-600">Products not matching either group → filtered (no role changes)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <StatCard label="Total Events" value={stats.total} color="#189aa1" />
          <StatCard label="Granted" value={stats.granted} color="#10b981" />
          <StatCard label="Pending Created" value={stats.pending} color="#3b82f6" />
          <StatCard label="Revoked" value={stats.revoked} color="#ef4444" />
          <StatCard label="Filtered" value={stats.filtered} color="#d97706" />
          <StatCard label="Ignored" value={stats.ignored} color="#9ca3af" />
          <StatCard label="Errors" value={stats.errors} color="#f97316" />
        </div>

        {/* Test tool */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="w-4 h-4 text-[#189aa1]" />
              Test Webhook
            </CardTitle>
            <CardDescription>
              Send a simulated order.created event to verify the webhook is working end-to-end.
              This will create or update the user's premium status in the database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="user@example.com"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                className="max-w-sm"
              />
              <Button
                onClick={() => testMutation.mutate({ email: testEmail })}
                disabled={!testEmail || testMutation.isPending}
                className="gap-2"
                style={{ background: "#189aa1" }}
              >
                {testMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Send Test
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Event log */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Webhook className="w-4 h-4 text-[#189aa1]" />
              Event Log
              <Badge variant="secondary" className="ml-auto text-xs">{events.length} events</Badge>
            </CardTitle>
            <CardDescription>Most recent 100 webhook events, newest first.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-gray-400 text-sm">Loading events…</div>
            ) : events.length === 0 ? (
              <div className="py-12 text-center">
                <Webhook className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No webhook events yet.</p>
                <p className="text-xs text-gray-400 mt-1">Events will appear here once Thinkific sends them.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs">Time</TableHead>
                      <TableHead className="text-xs">Event</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">Product</TableHead>
                      <TableHead className="text-xs">Outcome</TableHead>
                      <TableHead className="text-xs">Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((ev) => (
                      <TableRow key={ev.id} className="hover:bg-gray-50">
                        <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                          {new Date(ev.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs font-mono whitespace-nowrap">
                          <span className="text-gray-700">{ev.resource}</span>
                          <span className="text-gray-400">.</span>
                          <span className="text-[#189aa1]">{ev.action}</span>
                        </TableCell>
                        <TableCell className="text-xs text-gray-600 max-w-[160px] truncate">
                          {ev.email ?? <span className="text-gray-300">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600 max-w-[180px] truncate">
                          {ev.productName ?? <span className="text-gray-300">—</span>}
                        </TableCell>
                        <TableCell>
                          <OutcomeBadge outcome={ev.outcome} />
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 max-w-[240px] truncate">
                          {ev.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
