import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatSponsorshipAmount, sponsorshipTargetLabel } from "@shared/sponsorship";
import { Building2, Download, HandHeart, Loader2, RefreshCw, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { VendorPartnerAdminPanel } from "@/components/admin/VendorPartnerAdminPanel";

const STATUS_OPTIONS = ["all", "pending", "paid", "payment_failed", "cancelled"] as const;

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

function downloadCsv(rows: any[]) {
  const headers = ["Organization", "Contact", "Email", "Phone", "Level", "Amount", "Scope", "Workshop instance", "Status", "Submitted", "Paid", "Website", "Logo URL", "Notes"];
  const data = rows.map((row) => [
    row.organizationName,
    row.contactName,
    row.contactEmail,
    row.contactPhone,
    row.sponsorshipTier,
    formatSponsorshipAmount(Number(row.amountCents ?? 0), row.currency ?? "usd"),
    row.sponsorshipScope,
    sponsorshipTargetLabel({ scope: row.sponsorshipScope, workshopTitle: row.workshopTitle, workshopInstanceTitle: row.workshopInstanceTitle, otherPurpose: row.otherPurpose }),
    row.status,
    row.createdAt ? new Date(row.createdAt).toLocaleString() : "",
    row.paidAt ? new Date(row.paidAt).toLocaleString() : "",
    row.organizationWebsite,
    row.organizationLogoUrl,
    row.notes,
  ]);
  const blob = new Blob([[headers, ...data].map((line) => line.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `sponsorships-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SponsorshipAdmin() {
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const query = trpc.sponsorship.adminList.useQuery({ status });
  const rows = query.data?.rows ?? [];
  const summary = useMemo(() => ({
    organizations: new Set(rows.filter((row: any) => row.paymentStatus === "paid").map((row: any) => row.organizationName.toLowerCase())).size,
    paidCount: query.data?.paidCount ?? 0,
    paidTotal: query.data?.paidTotal ?? 0,
  }), [query.data?.paidCount, query.data?.paidTotal, rows]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="flex items-center gap-2 text-teal-700"><HandHeart className="h-5 w-5" /><span className="text-sm font-bold uppercase tracking-[0.15em]">Workshop partnerships</span></div><h1 className="mt-2 font-serif text-3xl font-bold text-slate-900">Exhibitors &amp; Sponsorships</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Review vendor and sponsor commitments, payment status, and the recognition details needed for follow-up.</p></div>
          <div className="flex gap-2"><Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button><Button className="bg-teal-600 text-white hover:bg-teal-700" onClick={() => downloadCsv(rows)} disabled={!rows.length}><Download className="mr-2 h-4 w-4" />Export CSV</Button></div>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Paid sponsorships</p><p className="mt-2 text-3xl font-bold text-slate-900">{summary.paidCount}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Paid support total</p><p className="mt-2 text-3xl font-bold text-teal-700">{formatSponsorshipAmount(summary.paidTotal)}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Supporting organizations</p><p className="mt-2 text-3xl font-bold text-slate-900">{summary.organizations}</p></div></div>

        <div className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-slate-900">Sponsorship records</h2><p className="mt-1 text-xs text-slate-500">Payments are confirmed from Stripe webhook fulfillment.</p></div><label className="flex items-center gap-2 text-sm text-slate-600">Status<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"><option value="all">All records</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="payment_failed">Payment failed</option><option value="cancelled">Cancelled</option></select></label></div>
          {query.isLoading ? <div className="flex items-center justify-center gap-3 py-20 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-teal-600" />Loading sponsorships…</div> : query.error ? <div className="p-8 text-sm text-red-700">Sponsorship records could not be loaded. Refresh the page or try again.</div> : rows.length === 0 ? <div className="p-12 text-center"><Building2 className="mx-auto h-10 w-10 text-slate-300" /><h3 className="mt-3 font-semibold text-slate-700">No sponsorship records yet</h3><p className="mt-1 text-sm text-slate-500">New sponsor payments will appear here automatically.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Organization &amp; contact</th><th className="px-5 py-3">Support</th><th className="px-5 py-3">Target</th><th className="px-5 py-3">Payment</th><th className="px-5 py-3">Dates</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row: any) => { const paymentFailed = row.paymentStatus === "failed" || row.status === "payment_failed"; return <tr key={row.id} className="align-top hover:bg-teal-50/30"><td className="px-5 py-4"><div className="flex gap-3">{row.organizationLogoUrl && <img src={row.organizationLogoUrl} alt={`${row.organizationName} logo`} className="h-12 w-12 shrink-0 rounded border border-slate-200 bg-white object-contain p-1" />}<div><p className="font-semibold text-slate-900">{row.organizationName}</p><p className="mt-1 text-slate-700">{row.contactName}</p><a className="text-teal-700 hover:underline" href={`mailto:${row.contactEmail}`}>{row.contactEmail}</a>{row.contactPhone && <p className="mt-1 text-xs text-slate-500">{row.contactPhone}</p>}{row.organizationWebsite && <a className="mt-1 block max-w-[220px] truncate text-xs text-teal-700 hover:underline" href={row.organizationWebsite} target="_blank" rel="noreferrer">{row.organizationWebsite}</a>}</div></div></td><td className="px-5 py-4"><span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold capitalize text-teal-800">{row.sponsorshipTier}</span><p className="mt-2 font-semibold text-slate-900">{formatSponsorshipAmount(Number(row.amountCents), row.currency ?? "usd")}</p><p className="mt-1 text-slate-500">{sponsorshipTargetLabel({ scope: row.sponsorshipScope })}</p></td><td className="max-w-[230px] px-5 py-4 text-slate-600">{sponsorshipTargetLabel({ scope: row.sponsorshipScope, workshopTitle: row.workshopTitle, workshopInstanceTitle: row.workshopInstanceTitle, otherPurpose: row.otherPurpose })}{row.notes && <p className="mt-2 rounded bg-slate-50 p-2 text-xs leading-5 text-slate-500">{row.notes}</p>}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.paymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : paymentFailed ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{row.paymentStatus === "paid" ? "Paid" : paymentFailed ? "Payment failed" : "Pending"}</span></td><td className="px-5 py-4 text-xs leading-5 text-slate-500"><p>Submitted<br/><span className="text-slate-700">{row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}</span></p>{row.paidAt && <p className="mt-3">Paid<br/><span className="text-slate-700">{new Date(row.paidAt).toLocaleString()}</span></p>}</td></tr>})}</tbody></table></div>}
        </div>
        <VendorPartnerAdminPanel scope="aaus_ihe" />
      </div>
    </div>
  );
}
