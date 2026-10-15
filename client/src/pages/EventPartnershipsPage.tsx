import { useMemo, useState } from "react";
import { Building2, CheckCircle2, Handshake, Loader2, Mail, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatEventPartnershipAmount, type EventPartnershipType } from "@shared/eventPartnership";

function parseRoute(): { targetType: EventPartnershipType; id: number } | null {
  const match = window.location.pathname.match(/^\/event-partnerships\/(workshop_exhibit|webinar_sponsor)\/(\d+)\/?$/);
  if (!match) return null;
  return { targetType: match[1] as EventPartnershipType, id: Number(match[2]) };
}

function packageBenefits(value: string | null | undefined) {
  return (value ?? "").split(/\n|•/).map(item => item.trim().replace(/^-\s*/, "")).filter(Boolean);
}

export default function EventPartnershipsPage() {
  const route = useMemo(parseRoute, []);
  const targetType = route?.targetType;
  const id = route?.id;
  const isExhibit = targetType === "workshop_exhibit";
  const [packageId, setPackageId] = useState<number | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationWebsite, setOrganizationWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const targetInput = route ? { targetType: route.targetType, ...(isExhibit ? { workshopInstanceId: id } : { webinarId: id }) } : undefined;
  const targetQuery = trpc.eventPartnership.getPublicTarget.useQuery(targetInput!, { enabled: !!targetInput, retry: false });
  const packagesQuery = trpc.eventPartnership.listPublicPackages.useQuery(targetInput!, { enabled: !!targetInput });
  const checkout = trpc.eventPartnership.createCheckout.useMutation({
    onSuccess: ({ checkoutUrl }) => { window.location.assign(checkoutUrl); },
  });
  const params = new URLSearchParams(window.location.search);

  if (!route) return <main className="mx-auto max-w-3xl px-4 py-16"><Card><CardContent className="p-8 text-center text-slate-600">This event partnership link is not valid.</CardContent></Card></main>;
  if (targetQuery.isLoading) return <main className="mx-auto flex min-h-[55vh] max-w-3xl items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-teal-700" /></main>;
  if (targetQuery.error || !targetQuery.data) return <main className="mx-auto max-w-3xl px-4 py-16"><Card><CardContent className="p-8 text-center"><h1 className="font-serif text-2xl font-semibold text-slate-900">Opportunity unavailable</h1><p className="mt-2 text-slate-600">This event partnership opportunity is not currently available.</p></CardContent></Card></main>;
  const target = targetQuery.data;
  const packages = packagesQuery.data ?? [];
  const selected = packages.find(item => item.id === packageId) ?? null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!packageId) return;
    checkout.mutate({ ...targetInput!, packageId, contactName, contactEmail, contactPhone: contactPhone || undefined, organizationName, organizationWebsite: organizationWebsite || undefined, notes: notes || undefined, origin: window.location.origin });
  };

  return <main className="min-h-screen bg-gradient-to-b from-cyan-50 via-white to-white py-10 sm:py-16">
    <div className="mx-auto max-w-6xl px-4">
      {params.get("status") === "complete" && <div className="mb-6 flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-teal-950"><CheckCircle2 className="h-5 w-5 text-teal-700" /><span>Thank you. Your payment was received and a confirmation has been sent.</span></div>}
      {params.get("status") === "cancelled" && <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">Checkout was not completed. You can select an option and try again whenever you are ready.</div>}
      <section className="rounded-3xl bg-[#0b4f59] px-6 py-10 text-white shadow-xl sm:px-10">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200/40 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100"><Handshake className="h-3.5 w-3.5" /> {isExhibit ? "Exhibitor opportunity" : "Webinar sponsor opportunity"}</div>
        <h1 className="max-w-4xl font-serif text-3xl font-bold leading-tight sm:text-4xl">{target.title}</h1>
        <p className="mt-4 max-w-3xl whitespace-pre-wrap text-base leading-7 text-cyan-50">{target.details || (isExhibit ? "Reserve an exhibit opportunity and connect directly with ultrasound education participants." : "Support this webinar and connect with the ultrasound education community.")}</p>
      </section>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_.85fr]">
        <section>
          <h2 className="font-serif text-2xl font-semibold text-slate-900">Choose your {isExhibit ? "exhibit" : "sponsorship"} option</h2>
          <p className="mt-2 text-slate-600">Options, availability, details, and pricing are set specifically for this event.</p>
          <div className="mt-5 space-y-4">
            {packages.length === 0 && <Card><CardContent className="p-6 text-slate-600">No options are currently available for this event. Please contact <a className="font-medium text-teal-800 underline" href="mailto:support@allaboutultrasound.com">support@allaboutultrasound.com</a>.</CardContent></Card>}
            {packages.map(item => <button type="button" key={item.id} onClick={() => setPackageId(item.id)} className={`w-full rounded-2xl border p-5 text-left transition ${packageId === item.id ? "border-teal-700 bg-teal-50 ring-2 ring-teal-200" : "border-slate-200 bg-white hover:border-teal-300"}`}>
              <div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold text-slate-900">{item.name}</h3>{item.description && <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>}</div><strong className="whitespace-nowrap text-lg text-teal-800">{formatEventPartnershipAmount(item.amountCents, item.currency)}</strong></div>
              {packageBenefits(item.benefits).length > 0 && <ul className="mt-4 space-y-2 text-sm text-slate-700">{packageBenefits(item.benefits).map((benefit, index) => <li className="flex gap-2" key={index}><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />{benefit}</li>)}</ul>}
            </button>)}
          </div>
        </section>
        <Card className="h-fit border-teal-100 shadow-lg"><CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2 text-xl"><Building2 className="h-5 w-5 text-teal-700" /> Reserve your placement</CardTitle></CardHeader><CardContent className="p-5">
          <form className="space-y-4" onSubmit={submit}>
            <p className="text-sm leading-6 text-slate-600">{selected ? <>You selected <strong>{selected.name}</strong>.</> : "Select an option to continue to secure Stripe checkout."}</p>
            <div><Label>Organization name *</Label><Input className="mt-1" required value={organizationName} onChange={e => setOrganizationName(e.target.value)} /></div>
            <div><Label>Contact name *</Label><Input className="mt-1" required value={contactName} onChange={e => setContactName(e.target.value)} /></div>
            <div><Label>Email *</Label><Input className="mt-1" type="email" required value={contactEmail} onChange={e => setContactEmail(e.target.value)} /></div>
            <div><Label>Phone</Label><Input className="mt-1" type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} /></div>
            <div><Label>Organization website</Label><Input className="mt-1" type="url" placeholder="https://" value={organizationWebsite} onChange={e => setOrganizationWebsite(e.target.value)} /></div>
            <div><Label>Notes or requests</Label><Textarea className="mt-1" rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
            <Button disabled={!selected || checkout.isPending} className="w-full bg-teal-700 hover:bg-[#0b4f59]">{checkout.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening secure checkout…</> : `Continue to secure checkout${selected ? ` · ${formatEventPartnershipAmount(selected.amountCents, selected.currency)}` : ""}`}</Button>
          </form>
          <div className="mt-4 flex items-start gap-2 border-t pt-4 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />Payments are processed securely by Stripe. Card information is never stored in this platform.</div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Mail className="h-3.5 w-3.5 text-teal-700" /><a href="mailto:support@allaboutultrasound.com" className="underline">support@allaboutultrasound.com</a></div>
        </CardContent></Card>
      </div>
    </div>
  </main>;
}
