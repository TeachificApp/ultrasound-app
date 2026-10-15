import { useState } from "react";
import { ExternalLink, Loader2, Plus, Save, ToggleLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { EVENT_PARTNERSHIP_TYPES, formatEventPartnershipAmount, type EventPartnershipType } from "@shared/eventPartnership";

type Props = { targetType: EventPartnershipType; workshopInstanceId?: number; webinarId?: number; publicTitle?: string };

export function EventPartnershipAdminPanel({ targetType, workshopInstanceId, webinarId, publicTitle }: Props) {
  const input = { targetType, ...(targetType === "workshop_exhibit" ? { workshopInstanceId: workshopInstanceId! } : { webinarId: webinarId! }) };
  const utils = trpc.useUtils();
  const query = trpc.eventPartnership.adminList.useQuery(input);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [benefits, setBenefits] = useState("");
  const [price, setPrice] = useState("");
  const create = trpc.eventPartnership.adminCreatePackage.useMutation({
    onSuccess: () => { utils.eventPartnership.adminList.invalidate(input); setName(""); setDescription(""); setBenefits(""); setPrice(""); toast.success("Event package created"); },
    onError: error => toast.error(error.message),
  });
  const update = trpc.eventPartnership.adminUpdatePackage.useMutation({
    onSuccess: () => { utils.eventPartnership.adminList.invalidate(input); toast.success("Event package updated"); },
    onError: error => toast.error(error.message),
  });
  const type = EVENT_PARTNERSHIP_TYPES[targetType];
  const id = targetType === "workshop_exhibit" ? workshopInstanceId : webinarId;
  const publicUrl = `${window.location.origin}/event-partnerships/${targetType}/${id}`;

  const addPackage = () => {
    const amountCents = Math.round(Number(price) * 100);
    if (!name.trim() || !Number.isFinite(amountCents) || amountCents < 50) { toast.error("Enter a package name and a price of at least $0.50."); return; }
    create.mutate({ ...input, name: name.trim(), description: description.trim() || undefined, benefits: benefits.trim() || undefined, amountCents, currency: "usd", sortOrder: (query.data?.packages.length ?? 0) * 10, isActive: true });
  };

  return <Card className="border-teal-200 bg-teal-50/40">
    <CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">{type.pluralLabel}</CardTitle><p className="mt-1 text-xs leading-5 text-slate-600">Create event-specific options, pricing, benefits, and public checkout. Set inactive instead of deleting a package so existing payment records remain intact.</p></div><a href={publicUrl} target="_blank" rel="noreferrer"><Button type="button" size="sm" variant="outline" className="border-teal-300 text-teal-800"><ExternalLink className="mr-1 h-3.5 w-3.5" /> View public page</Button></a></div></CardHeader>
    <CardContent className="space-y-4">
      {query.isLoading && <div className="flex items-center gap-2 py-3 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Loading event packages…</div>}
      {query.data?.packages.map(pkg => <div key={pkg.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-slate-900">{pkg.name}</p><p className="text-sm font-semibold text-teal-800">{formatEventPartnershipAmount(pkg.amountCents, pkg.currency)}</p>{pkg.description && <p className="mt-1 text-xs text-slate-600">{pkg.description}</p>}</div><div className="flex items-center gap-2 text-xs"><Switch checked={pkg.isActive} onCheckedChange={isActive => update.mutate({ ...input, id: pkg.id, isActive })} disabled={update.isPending} /><span>{pkg.isActive ? "Active" : "Inactive"}</span></div></div>
        <div className="mt-3 grid gap-2 md:grid-cols-2"><Input defaultValue={pkg.name} aria-label="Package name" onBlur={e => { const next = e.target.value.trim(); if (next && next !== pkg.name) update.mutate({ ...input, id: pkg.id, name: next }); }} /><Input defaultValue={(pkg.amountCents / 100).toFixed(2)} type="number" min="0.50" step="0.01" aria-label="Package price" onBlur={e => { const amountCents = Math.round(Number(e.target.value) * 100); if (Number.isFinite(amountCents) && amountCents >= 50 && amountCents !== pkg.amountCents) update.mutate({ ...input, id: pkg.id, amountCents }); }} /></div>
      </div>)}
      {query.data?.orders.length ? <div className="rounded-xl border border-cyan-100 bg-white p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Recorded selections</p>{query.data.orders.map(order => <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t py-2 text-sm first:border-t-0" key={order.id}><span><strong>{order.organizationName}</strong> · {order.packageName}</span><span className={order.paymentStatus === "paid" ? "font-medium text-teal-800" : "text-amber-700"}>{formatEventPartnershipAmount(order.amountCents, order.currency)} · {order.paymentStatus}</span></div>)}</div> : null}
      <div className="rounded-xl border border-dashed border-teal-300 bg-white p-4"><p className="mb-3 text-sm font-semibold text-slate-900"><Plus className="mr-1 inline h-4 w-4 text-teal-700" /> Add a {type.packageLabel.toLowerCase()}</p><div className="grid gap-3 md:grid-cols-2"><div><Label className="text-xs">Name *</Label><Input className="mt-1" value={name} onChange={e => setName(e.target.value)} placeholder={targetType === "workshop_exhibit" ? "e.g. Tabletop exhibit" : "e.g. Presenting sponsor"} /></div><div><Label className="text-xs">Price (USD) *</Label><Input className="mt-1" value={price} onChange={e => setPrice(e.target.value)} type="number" min="0.50" step="0.01" placeholder="2500.00" /></div></div><div className="mt-3"><Label className="text-xs">Details</Label><Textarea className="mt-1" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What this option includes or who it is best for." /></div><div className="mt-3"><Label className="text-xs">Benefits</Label><Textarea className="mt-1" value={benefits} onChange={e => setBenefits(e.target.value)} rows={3} placeholder="One benefit per line" /><p className="mt-1 text-xs text-slate-500">Each line is shown as a benefit on the public checkout page.</p></div><Button type="button" className="mt-3 bg-teal-700 hover:bg-[#0b4f59]" disabled={create.isPending} onClick={addPackage}>{create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Add {type.packageLabel}</Button></div>
    </CardContent>
  </Card>;
}
