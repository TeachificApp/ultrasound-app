import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Copy, ExternalLink, TrendingUp, DollarSign, Link2, Users, Clock, CheckCircle2, XCircle, AlertCircle
} from "lucide-react";

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">{icon}</div>
          <div>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Payout Request Dialog ────────────────────────────────────────────────────
function PayoutRequestDialog({ open, onClose, affiliateId }: { open: boolean; onClose: () => void; affiliateId: number }) {
  const [method, setMethod] = useState<"stripe" | "paypal" | "ach">("stripe");
  const [details, setDetails] = useState("");
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();

  const requestPayout = trpc.lmsAdmin.requestPayout.useMutation({
    onSuccess: () => {
      toast.success("Payout request submitted! An admin will review it shortly.");
      utils.lmsAdmin.getMyAffiliateProfile.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const methodLabels: Record<string, string> = { stripe: "Stripe (email)", paypal: "PayPal (email)", ach: "Bank ACH (account details)" };
  const methodPlaceholders: Record<string, string> = {
    stripe: "your@email.com",
    paypal: "your@paypal.com",
    ach: "Bank name, routing #, account #",
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Payout</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Payment Method</Label>
            <Select value={method} onValueChange={v => setMethod(v as any)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(methodLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{methodLabels[method]}</Label>
            <Input
              className="mt-1"
              placeholder={methodPlaceholders[method]}
              value={details}
              onChange={e => setDetails(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Textarea
              className="mt-1 resize-none"
              rows={2}
              placeholder="Any additional details..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
          <p className="text-xs text-gray-400">Payouts are reviewed and processed by the platform admin. You will be notified once approved.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            disabled={!details.trim() || requestPayout.isPending}
            onClick={() => requestPayout.mutate({ affiliateId, paymentMethod: method, paymentDetails: details, note })}
          >
            {requestPayout.isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Course Link Card ─────────────────────────────────────────────────────────
function CourseLinkCard({ course, affiliateId }: { course: any; affiliateId: number }) {
  const [generating, setGenerating] = useState(false);
  const utils = trpc.useUtils();

  const generateLink = trpc.lmsAdmin.generateAffiliateLink.useMutation({
    onSuccess: () => {
      utils.lmsAdmin.getMyAffiliateCourses.invalidate();
      toast.success("Affiliate link generated!");
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setGenerating(false),
  });

  const link = course.link;
  const trackingUrl = link ? `${window.location.origin}/ref/${link.slug}` : null;

  const copyLink = () => {
    if (!trackingUrl) return;
    navigator.clipboard.writeText(trackingUrl);
    toast.success("Link copied to clipboard!");
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {course.coverImageUrl ? (
            <img src={course.coverImageUrl} alt={course.title} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
              <Link2 size={20} className="text-teal-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{course.title}</p>
            <p className="text-xs text-teal-600 font-medium mt-0.5">{course.commissionPct}% commission</p>
            {link && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 bg-gray-50 rounded px-2 py-1 text-[10px] text-gray-600 font-mono truncate border border-gray-200">
                    {trackingUrl}
                  </div>
                  <Button size="sm" variant="outline" className="h-7 px-2 flex-shrink-0" onClick={copyLink}>
                    <Copy size={12} />
                  </Button>
                  <a href={trackingUrl!} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="h-7 px-2 flex-shrink-0">
                      <ExternalLink size={12} />
                    </Button>
                  </a>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-400">
                  <span>{link.clicks ?? 0} clicks</span>
                  <span>{link.conversions ?? 0} conversions</span>
                </div>
              </div>
            )}
            {!link && (
              <Button
                size="sm"
                className="mt-2 h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                disabled={generating}
                onClick={() => {
                  setGenerating(true);
                  generateLink.mutate({
                    courseId: course.id,
                    destinationUrl: `${window.location.origin}/courses/${course.slug}`,
                  });
                }}
              >
                {generating ? "Generating..." : "Generate Link"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AffiliateDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [payoutOpen, setPayoutOpen] = useState(false);

  const { data: profile, isLoading: profileLoading } = trpc.lmsAdmin.getMyAffiliateProfile.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: courses, isLoading: coursesLoading } = trpc.lmsAdmin.getMyAffiliateCourses.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: conversions } = trpc.lmsAdmin.getMyAffiliateConversions.useQuery(undefined, {
    enabled: !!user,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-sm w-full mx-4">
          <CardContent className="pt-8 pb-6 text-center">
            <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
              <DollarSign size={24} className="text-teal-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Affiliate Dashboard</h2>
            <p className="text-sm text-gray-500 mb-4">Sign in to access your affiliate dashboard and earnings.</p>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white w-full" onClick={() => window.location.href = getLoginUrl()}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasAffiliateRole = user.appRoles?.includes("affiliate" as any);
  if (!profileLoading && !profile && !hasAffiliateRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-sm w-full mx-4">
          <CardContent className="pt-8 pb-6 text-center">
            <AlertCircle size={32} className="text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">Not an Affiliate</h2>
            <p className="text-sm text-gray-500">Your account does not have affiliate access. Contact the platform admin to get set up.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalEarnings = (conversions ?? []).reduce((sum: number, c: any) => sum + (c.commissionAmount ?? 0), 0);
  const pendingEarnings = (conversions ?? []).filter((c: any) => c.status === "pending").reduce((sum: number, c: any) => sum + (c.commissionAmount ?? 0), 0);
  const totalClicks = (courses ?? []).reduce((sum: number, c: any) => sum + (c.link?.clicks ?? 0), 0);
  const totalConversions = (conversions ?? []).length;

  const statusIcon = (status: string) => {
    if (status === "approved") return <CheckCircle2 size={14} className="text-green-500" />;
    if (status === "rejected") return <XCircle size={14} className="text-red-400" />;
    return <Clock size={14} className="text-amber-500" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Affiliate Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {profile ? <>Code: <span className="font-mono font-semibold text-teal-700">{profile.code}</span> · {profile.commissionPct}% base commission</> : "Loading..."}
            </p>
          </div>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => setPayoutOpen(true)}
            disabled={!profile}
          >
            <DollarSign size={15} className="mr-1.5" /> Request Payout
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<DollarSign size={18} />} label="Total Earnings" value={`$${(totalEarnings / 100).toFixed(2)}`} sub="All time" />
          <StatCard icon={<Clock size={18} />} label="Pending" value={`$${(pendingEarnings / 100).toFixed(2)}`} sub="Awaiting payout" />
          <StatCard icon={<TrendingUp size={18} />} label="Total Clicks" value={totalClicks} sub="Across all links" />
          <StatCard icon={<Users size={18} />} label="Conversions" value={totalConversions} sub="Completed sales" />
        </div>

        {/* My Affiliate Links */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">My Affiliate Links</h2>
          {coursesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : !courses?.length ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-gray-400">
                <Link2 size={28} className="mx-auto mb-2 text-gray-300" />
                No courses assigned yet. Contact the platform admin to get access to courses you can promote.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {courses.map((c: any) => (
                <CourseLinkCard key={c.id} course={c} affiliateId={profile?.id ?? 0} />
              ))}
            </div>
          )}
        </div>

        {/* Conversion History */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Conversion History</h2>
          {!conversions?.length ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-gray-400">
                No conversions yet. Share your links to start earning!
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Course</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Sale</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Commission</th>
                        <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversions.map((c: any) => (
                        <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-3 text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-xs text-gray-700">{c.courseId ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-gray-700 text-right">${((c.saleAmount ?? 0) / 100).toFixed(2)}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-teal-700 text-right">${((c.commissionAmount ?? 0) / 100).toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {statusIcon(c.status)}
                              <span className="text-xs capitalize text-gray-600">{c.status}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {profile && (
        <PayoutRequestDialog
          open={payoutOpen}
          onClose={() => setPayoutOpen(false)}
          affiliateId={profile.id}
        />
      )}
    </div>
  );
}
