import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Copy, ExternalLink, TrendingUp, DollarSign, Link2, Users, Clock, CheckCircle2, XCircle, AlertCircle, History
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
function PayoutRequestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [method, setMethod] = useState<"stripe" | "paypal" | "ach">("paypal");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [achRouting, setAchRouting] = useState("");
  const [achAccount, setAchAccount] = useState("");
  const [stripeAccount, setStripeAccount] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const utils = trpc.useUtils();

  const requestPayout = trpc.lmsAdmin.requestPayout.useMutation({
    onSuccess: () => {
      toast.success("Payout request submitted! An admin will review it shortly.");
      utils.lmsAdmin.getMyPayoutRequests.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const isValid = () => {
    const cents = Math.round(parseFloat(amountDollars) * 100);
    if (!amountDollars || isNaN(cents) || cents < 100) return false;
    if (method === "paypal") return paypalEmail.includes("@");
    if (method === "ach") return achRouting.length >= 9 && achAccount.length >= 4;
    if (method === "stripe") return stripeAccount.trim().length > 0;
    return false;
  };

  const handleSubmit = () => {
    const cents = Math.round(parseFloat(amountDollars) * 100);
    const paymentDetails: any = {};
    if (method === "paypal") paymentDetails.paypal_email = paypalEmail;
    if (method === "ach") { paymentDetails.ach_routing = achRouting; paymentDetails.ach_account = achAccount; }
    if (method === "stripe") paymentDetails.stripe_account_id = stripeAccount;
    requestPayout.mutate({
      requestorType: "affiliate",
      amountCents: cents,
      paymentMethod: method,
      paymentDetails,
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Payout</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Amount to Request (USD)</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <Input
                className="pl-7"
                placeholder="0.00"
                type="number"
                min="1"
                step="0.01"
                value={amountDollars}
                onChange={e => setAmountDollars(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Minimum $1.00</p>
          </div>
          <div>
            <Label className="text-xs">Payment Method</Label>
            <Select value={method} onValueChange={v => setMethod(v as any)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="ach">Bank ACH Transfer</SelectItem>
                <SelectItem value="stripe">Stripe Account</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {method === "paypal" && (
            <div>
              <Label className="text-xs">PayPal Email</Label>
              <Input className="mt-1" placeholder="your@paypal.com" type="email" value={paypalEmail} onChange={e => setPaypalEmail(e.target.value)} />
            </div>
          )}
          {method === "ach" && (
            <>
              <div>
                <Label className="text-xs">Routing Number</Label>
                <Input className="mt-1" placeholder="9-digit routing number" value={achRouting} onChange={e => setAchRouting(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Account Number</Label>
                <Input className="mt-1" placeholder="Account number" value={achAccount} onChange={e => setAchAccount(e.target.value)} />
              </div>
            </>
          )}
          {method === "stripe" && (
            <div>
              <Label className="text-xs">Stripe Account ID</Label>
              <Input className="mt-1" placeholder="acct_..." value={stripeAccount} onChange={e => setStripeAccount(e.target.value)} />
            </div>
          )}
          <p className="text-xs text-gray-400">Payouts are reviewed and processed by the platform admin within 5–7 business days.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            disabled={!isValid() || requestPayout.isPending}
            onClick={handleSubmit}
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
    onSuccess: () => { utils.lmsAdmin.getMyAffiliateCourses.invalidate(); setGenerating(false); },
    onError: (err) => { toast.error(err.message); setGenerating(false); },
  });

  const trackingUrl = course.link?.url ?? null;

  const copyLink = () => {
    if (!trackingUrl) return;
    navigator.clipboard.writeText(trackingUrl).then(() => toast.success("Link copied!"));
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {course.thumbnailUrl ? (
            <img src={course.thumbnailUrl} alt={course.title} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
              <Link2 size={20} className="text-teal-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{course.title}</p>
            <p className="text-xs text-teal-600 font-medium">{course.commissionPct ?? 0}% commission</p>
            {trackingUrl ? (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 bg-gray-50 rounded px-2 py-1 text-[10px] text-gray-600 font-mono truncate border border-gray-200">
                    {trackingUrl}
                  </div>
                  <button onClick={copyLink} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 flex-shrink-0" title="Copy link">
                    <Copy size={13} />
                  </button>
                  <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-gray-100 text-gray-500 flex-shrink-0" title="Open link">
                    <ExternalLink size={13} />
                  </a>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-400">
                  <span>{course.link?.clicks ?? 0} clicks</span>
                  <span>{course.link?.conversions ?? 0} conversions</span>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7 text-xs"
                disabled={generating}
                onClick={() => { setGenerating(true); generateLink.mutate({ affiliateId, courseId: course.id }); }}
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

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
      <CheckCircle2 size={10} /> Approved
    </span>
  );
  if (status === "rejected") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">
      <XCircle size={10} /> Rejected
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      <Clock size={10} /> Pending
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
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
  const { data: payoutRequests } = trpc.lmsAdmin.getMyPayoutRequests.useQuery(undefined, {
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

  const hasAffiliateRole = (user as any).appRoles?.includes("affiliate");
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
  const pendingEarnings = (conversions ?? []).filter((c: any) => !c.paidAt).reduce((sum: number, c: any) => sum + (c.commissionAmount ?? 0), 0);
  const totalClicks = (courses ?? []).reduce((sum: number, c: any) => sum + (c.link?.clicks ?? 0), 0);
  const totalConversions = (conversions ?? []).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sm:py-5">
        <div className="max-w-5xl mx-auto flex items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Affiliate Dashboard</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">
              {profile ? (
                <>Code: <span className="font-mono font-semibold text-teal-700">{profile.code}</span>
                  <span className="hidden sm:inline"> · {profile.commissionPct}% base commission</span>
                </>
              ) : "Loading..."}
            </p>
          </div>
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white flex-shrink-0"
            onClick={() => setPayoutOpen(true)}
            disabled={!profile}
          >
            <DollarSign size={14} className="mr-1" /> <span className="hidden sm:inline">Request </span>Payout
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-6 sm:space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<DollarSign size={18} />} label="Total Earnings" value={`$${Number(totalEarnings).toFixed(2)}`} sub="All time" />
          <StatCard icon={<Clock size={18} />} label="Unpaid" value={`$${Number(pendingEarnings).toFixed(2)}`} sub="Awaiting payout" />
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
                        <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500">Date</th>
                        <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 hidden sm:table-cell">Course / Product</th>
                        <th className="text-right px-3 sm:px-4 py-3 text-xs font-medium text-gray-500">Sale</th>
                        <th className="text-right px-3 sm:px-4 py-3 text-xs font-medium text-gray-500">Commission</th>
                        <th className="text-center px-3 sm:px-4 py-3 text-xs font-medium text-gray-500">Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversions.map((c: any) => (
                        <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-3 sm:px-4 py-3 text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                          <td className="px-3 sm:px-4 py-3 text-xs text-gray-700 hidden sm:table-cell">{c.courseTitle ?? "—"}</td>
                          <td className="px-3 sm:px-4 py-3 text-xs text-gray-700 text-right">${((c.saleAmount ?? 0) / 100).toFixed(2)}</td>
                          <td className="px-3 sm:px-4 py-3 text-xs font-semibold text-teal-700 text-right">${((c.commissionAmount ?? 0) / 100).toFixed(2)}</td>
                          <td className="px-3 sm:px-4 py-3 text-center">
                            {c.paidAt ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-green-600">
                                <CheckCircle2 size={11} /> {new Date(c.paidAt).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
                                <Clock size={11} /> Pending
                              </span>
                            )}
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

        {/* Payout Request History */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <History size={16} className="text-gray-400" /> Payout Requests
          </h2>
          {!payoutRequests?.length ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-gray-400">
                No payout requests yet. Click "Request Payout" above to submit one.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500">Requested</th>
                        <th className="text-right px-3 sm:px-4 py-3 text-xs font-medium text-gray-500">Amount</th>
                        <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 hidden sm:table-cell">Method</th>
                        <th className="text-center px-3 sm:px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                        <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 hidden md:table-cell">Admin Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payoutRequests.map((r: any) => (
                        <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-3 sm:px-4 py-3 text-xs text-gray-500">{new Date(r.requestedAt).toLocaleDateString()}</td>
                          <td className="px-3 sm:px-4 py-3 text-xs font-semibold text-gray-900 text-right">${((r.amountCents ?? 0) / 100).toFixed(2)}</td>
                          <td className="px-3 sm:px-4 py-3 text-xs text-gray-600 capitalize hidden sm:table-cell">{r.paymentMethod}</td>
                          <td className="px-3 sm:px-4 py-3 text-center">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{r.adminNote ?? "—"}</td>
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

      <PayoutRequestDialog
        open={payoutOpen}
        onClose={() => setPayoutOpen(false)}
      />
    </div>
  );
}
