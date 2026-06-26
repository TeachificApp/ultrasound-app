/**
 * Duplicate Payments Admin — review flagged duplicate charges and duplicate brand memberships.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle, ExternalLink, RefreshCw, Shield, Copy, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

const KIND_LABELS: Record<string, string> = {
  lms_duplicate_payment: "LMS duplicate charge",
  membership_duplicate_subscription: "Duplicate subscription",
  already_purchased_download: "Download already owned",
  already_purchased_bundle: "Bundle already owned",
  already_purchased_brand_membership: "Brand membership duplicate",
  already_purchased_physical: "Physical product duplicate",
};

function stripePaymentUrl(message: string): string | null {
  const m = message.match(/pi=([a-zA-Z0-9_]+)/);
  if (m) return `https://dashboard.stripe.com/payments/${m[1]}`;
  return null;
}

function stripeSubUrl(id: string | null | undefined): string | null {
  if (!id) return null;
  return `https://dashboard.stripe.com/subscriptions/${id}`;
}

export default function DuplicatePaymentsAdmin() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = (user as { role?: string })?.role === "admin";
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const {
    data: events = [],
    isLoading: eventsLoading,
    refetch: refetchEvents,
  } = trpc.premium.adminGetDuplicatePaymentEvents.useQuery(
    { limit: 100 },
    { enabled: isAdmin, refetchInterval: 60_000 },
  );

  const {
    data: duplicateMemberships = [],
    isLoading: membershipsLoading,
    refetch: refetchMemberships,
  } = trpc.premium.adminAuditDuplicateBrandMemberships.useQuery(undefined, {
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">Admin Access Required</h2>
          <Button variant="outline" onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </Layout>
    );
  }

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const refetchAll = () => {
    refetchEvents();
    refetchMemberships();
  };

  return (
    <Layout>
      <div className="container py-8 max-w-6xl">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-50">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                Duplicate Payments
              </h1>
              <p className="text-sm text-gray-500">
                Flagged webhook events and duplicate brand memberships — review in Stripe before renewals
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={refetchAll}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
        </div>

        {/* Flagged events */}
        <Card className="mb-8 border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Flagged duplicate events
              <Badge variant="secondary">{events.length}</Badge>
            </CardTitle>
            <CardDescription>
              Logged when a second checkout completes for content the user already owns, or duplicate subscriptions are detected
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {eventsLoading ? (
              <p className="p-6 text-sm text-gray-500">Loading…</p>
            ) : events.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm">No flagged duplicate payment events</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Stripe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((ev) => {
                    const payUrl = stripePaymentUrl(ev.message ?? "");
                    return (
                      <TableRow key={ev.id}>
                        <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                          {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                            {KIND_LABELS[ev.action] ?? ev.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{ev.email ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-[140px] truncate">{ev.productName ?? "—"}</TableCell>
                        <TableCell className="text-xs text-gray-600 max-w-xs">
                          <span className="line-clamp-2" title={ev.message ?? ""}>{ev.message}</span>
                          <button
                            type="button"
                            className="text-[10px] text-teal-600 hover:underline mt-0.5 inline-flex items-center gap-0.5"
                            onClick={() => handleCopy(ev.message ?? "", ev.id)}
                          >
                            {copiedId === ev.id ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            Copy
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          {payUrl && (
                            <a href={payUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline inline-flex items-center gap-1">
                              Payment <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Duplicate brand memberships */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Duplicate brand memberships
              <Badge variant={duplicateMemberships.length > 0 ? "destructive" : "secondary"}>
                {duplicateMemberships.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Users with two or more active premium rows for the same brand — review subscriptions in Stripe before they renew
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {membershipsLoading ? (
              <p className="p-6 text-sm text-gray-500">Loading audit…</p>
            ) : duplicateMemberships.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm">No duplicate active brand memberships found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Active rows</TableHead>
                    <TableHead>Subscriptions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duplicateMemberships.map((row) => (
                    <TableRow key={`${row.userId}-${row.brand}`}>
                      <TableCell>
                        <div className="text-sm font-medium">{row.name ?? `User #${row.userId}`}</div>
                        <div className="text-xs text-gray-500">{row.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">{row.brand}</Badge>
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-amber-700">{row.activeCount}</TableCell>
                      <TableCell className="text-xs space-y-1">
                        {row.memberships.map((m) => (
                          <div key={m.id} className="flex flex-wrap items-center gap-1">
                            <span className="text-gray-500">#{m.id}</span>
                            <span>{m.tier}</span>
                            {m.stripeSubscriptionId && (
                              <a
                                href={stripeSubUrl(m.stripeSubscriptionId)!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-teal-600 hover:underline font-mono text-[10px]"
                              >
                                {m.stripeSubscriptionId.slice(0, 14)}…
                              </a>
                            )}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.memberships[0]?.stripeCustomerId && (
                          <a
                            href={`https://dashboard.stripe.com/customers/${row.memberships[0].stripeCustomerId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-teal-600 hover:underline inline-flex items-center gap-1"
                          >
                            Customer <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
