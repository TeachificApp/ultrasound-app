/**
 * PartnerPortal.tsx
 * Partner-facing earnings portal.
 * Partners see ONLY their own earnings — no platform-level data.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DollarSign, CheckCircle, Clock, AlertCircle, ExternalLink,
  TrendingUp, BookOpen, Package, Download, Layers, CreditCard, Wrench,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
}
function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
const PRODUCT_TYPE_LABELS: Record<string, string> = {
  course: "Course",
  bundle: "Bundle",
  download: "Digital Download",
  download_bundle: "Download Bundle",
  membership: "Membership",
  workshop: "Workshop",
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PartnerPortal() {
  const { user, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#189aa1]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <DollarSign className="h-12 w-12 text-[#189aa1]" />
        <h1 className="text-2xl font-bold">Partner Portal</h1>
        <p className="text-muted-foreground">Sign in to view your earnings and payout history.</p>
        <Button
          onClick={() => window.location.href = getLoginUrl("/partner-portal")}
          className="bg-[#189aa1] hover:bg-[#147a80]"
        >
          Sign In
        </Button>
      </div>
    );
  }

  return <PartnerEarningsView userId={user.id} />;
}

function PartnerEarningsView({ userId }: { userId: number }) {
  const { data, isLoading } = trpc.revenueShare.getMyEarnings.useQuery();
  const dashboardMutation = trpc.revenueShare.getExpressDashboardLink.useMutation({
    onSuccess: (d: any) => { if (d?.url) window.open(d.url, "_blank"); },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#189aa1]" />
      </div>
    );
  }

  if (!data || !data.partner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <DollarSign className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Partner Portal</h1>
        <p className="text-muted-foreground max-w-sm">
          Your account is not currently linked to a revenue share partner profile.
          Please contact the platform administrator.
        </p>
      </div>
    );
  }

  const { partner, ledger, totalEarned, totalPending } = data;
  const summary = { totalPaid: totalEarned, totalPending, totalCount: ledger?.length ?? 0 };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[#189aa1]" />
              Partner Earnings Portal
            </h1>
            <p className="text-sm text-muted-foreground">Welcome back, {partner.name}</p>
          </div>
          {partner.stripeAccountId && partner.onboardingStatus === "active" && (
            <Button
              variant="outline"
              onClick={() => dashboardMutation.mutate()}
              disabled={dashboardMutation.isPending}
              className="gap-1.5"
            >
              <ExternalLink className="h-4 w-4" />
              Stripe Dashboard
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Onboarding notice */}
        {partner.onboardingStatus !== "active" && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800">Stripe onboarding incomplete</p>
                <p className="text-sm text-amber-700">Complete your Stripe account setup to receive payouts. Contact the platform administrator for your onboarding link.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" /> Total Earned
              </div>
              <div className="text-2xl font-bold text-green-600">{fmtMoney(summary.totalPaid)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Clock className="h-3.5 w-3.5 text-amber-500" /> Pending
              </div>
              <div className="text-2xl font-bold text-amber-600">{fmtMoney(summary.totalPending)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-[#189aa1]" /> Total Transactions
              </div>
              <div className="text-2xl font-bold text-[#189aa1]">{summary.totalCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Earnings table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Earnings History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!ledger || ledger.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No earnings yet. Your payout history will appear here.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Your Earnings</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.productTitle ?? `Product #${r.productId}`}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {PRODUCT_TYPE_LABELS[r.productType] ?? r.productType}
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-[#189aa1]">
                        {fmtMoney(r.shareAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          r.status === "paid" ? "default" :
                          r.status === "failed" ? "destructive" : "secondary"
                        } className="gap-1">
                          {r.status === "paid" ? <CheckCircle className="h-3 w-3" /> :
                           r.status === "failed" ? <AlertCircle className="h-3 w-3" /> :
                           <Clock className="h-3 w-3" />}
                          {r.status === "paid" ? "Paid" : r.status === "failed" ? "Failed" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{fmtDate(r.paidAt ?? r.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground">
          Earnings shown are your share only. Payment timing depends on your payout schedule and Stripe's standard processing window.
        </p>
      </div>
    </div>
  );
}
