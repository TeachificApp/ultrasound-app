import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Check, CircleAlert, CreditCard, Loader2, LockKeyhole } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { EXPO_PACKAGE_TYPE_META, formatExpoMoney, type ExpoPackageType, ULTRASOUND_EXPO_NAME } from "@shared/ultrasoundExpo";

const typeLabels: ExpoPackageType[] = ["registrant", "exhibitor", "sponsor", "product", "other"];

type FormState = { attendeeName: string; attendeeEmail: string; attendeePhone: string; organizationName: string; organizationWebsite: string; notes: string };
const emptyForm: FormState = { attendeeName: "", attendeeEmail: "", attendeePhone: "", organizationName: "", organizationWebsite: "", notes: "" };

function safeSelection(location: string): ExpoPackageType {
  const input = new URLSearchParams(location.split("?")[1] ?? "").get("type");
  return typeLabels.includes(input as ExpoPackageType) ? input as ExpoPackageType : "registrant";
}

export default function UltrasoundExpoRegister() {
  const [location] = useLocation();
  const [selectedType, setSelectedType] = useState<ExpoPackageType>(() => safeSelection(location));
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const { data, isLoading, error } = trpc.ultrasoundExpo.publicLaunch.useQuery();
  const checkout = trpc.ultrasoundExpo.createCheckout.useMutation({
    onSuccess: ({ checkoutUrl }) => { window.location.assign(checkoutUrl); },
  });
  const packages = useMemo(() => (data?.packages ?? []).filter(item => item.packageType === selectedType), [data?.packages, selectedType]);
  const selectedPackage = packages.find(item => item.id === selectedPackageId) ?? packages[0] ?? null;

  useEffect(() => {
    setSelectedType(safeSelection(location));
  }, [location]);
  useEffect(() => {
    setSelectedPackageId(packages[0]?.id ?? null);
  }, [selectedType, packages]);

  const update = (field: keyof FormState, value: string) => setForm(previous => ({ ...previous, [field]: value }));
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPackage) return;
    checkout.mutate({ ...form, packageId: selectedPackage.id, origin: window.location.origin });
  };
  const businessFields = selectedType === "exhibitor" || selectedType === "sponsor";

  return <div className="min-h-screen bg-[#f3fafb] text-slate-900">
    <header className="border-b border-cyan-100 bg-[#062634] text-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6"><Link href="/" className="font-black tracking-[-.04em]">Ultrasound<span className="text-[#72e1de]">Expo™</span></Link><Link href="/expo-dashboard" className="text-sm font-semibold text-[#a1efea] hover:text-white">My Expo Dashboard</Link></div></header>
    <main className="mx-auto max-w-6xl px-4 py-9 sm:px-6 sm:py-14"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#087f8c] hover:text-[#065f68]"><ArrowLeft className="h-4 w-4" /> Back to UltrasoundExpo™</Link>
      <div className="mt-7 grid gap-8 lg:grid-cols-[1.03fr_.97fr]">
        <section><p className="text-xs font-black uppercase tracking-[.2em] text-[#087f8c]">Secure registration</p><h1 className="mt-3 text-4xl font-black tracking-[-.05em] text-[#062634] sm:text-5xl">Join UltrasoundExpo™</h1><p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">Choose a published annual event option, then complete checkout through secure Stripe payment. Registrations, exhibits, and sponsorships are separate Expo records managed from your Expo Dashboard.</p>
          <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Expo registration category">{typeLabels.map(type => <button key={type} type="button" onClick={() => setSelectedType(type)} className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${selectedType === type ? "border-[#087f8c] bg-[#087f8c] text-white" : "border-cyan-200 bg-white text-slate-600 hover:border-[#087f8c]"}`}>{EXPO_PACKAGE_TYPE_META[type].label}</button>)}</div>
          {isLoading ? <div className="mt-8 flex items-center gap-2 rounded-2xl border border-cyan-100 bg-white p-6 text-slate-600"><Loader2 className="h-5 w-5 animate-spin text-[#087f8c]" /> Loading Expo options…</div> : error ? <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"><CircleAlert className="mr-2 inline h-4 w-4" /> We could not load current Expo options. Please try again shortly.</div> : packages.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed border-cyan-300 bg-white p-7"><h2 className="text-xl font-black text-[#062634]">{EXPO_PACKAGE_TYPE_META[selectedType].label} options are coming soon.</h2><p className="mt-2 max-w-md leading-7 text-slate-600">The Expo team has not published a current option in this category. You can still explore the event or contact the organizer to express interest.</p><a href="mailto:support@allaboutultrasound.com?subject=UltrasoundExpo%E2%84%A2%20interest" className="mt-4 inline-flex font-bold text-[#087f8c] hover:underline">Contact the Expo team <ArrowRight className="ml-2 h-4 w-4" /></a></div> : <div className="mt-8 space-y-3">{packages.map(option => <button type="button" key={option.id} onClick={() => setSelectedPackageId(option.id)} className={`w-full rounded-2xl border p-5 text-left transition-all ${selectedPackage?.id === option.id ? "border-[#087f8c] bg-[#eafafa] ring-1 ring-[#087f8c]" : "border-slate-200 bg-white hover:border-cyan-300"}`}><div className="flex gap-4"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selectedPackage?.id === option.id ? "border-[#087f8c] bg-[#087f8c] text-white" : "border-slate-300"}`}>{selectedPackage?.id === option.id && <Check className="h-3.5 w-3.5" />}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-start justify-between gap-2"><span className="text-lg font-black text-[#062634]">{option.name}</span><span className="text-lg font-black text-[#087f8c]">{formatExpoMoney(option.amountCents, option.currency)}</span></span>{option.description && <span className="mt-2 block text-sm leading-6 text-slate-600">{option.description}</span>}{option.benefits && <span className="mt-3 block whitespace-pre-line text-sm leading-6 text-slate-600">{option.benefits}</span>}</span></div></button>)}</div>}
          <div className="mt-8 rounded-2xl border border-cyan-100 bg-white p-6"><h2 className="font-black text-[#062634]">Built for a future annual event</h2><p className="mt-2 text-sm leading-6 text-slate-600">Packages, dates, venue, and all event details are controlled separately for each UltrasoundExpo™ year. Policies, payment records, and receipts will reflect the final option you select.</p></div>
        </section>
        <aside className="lg:pt-10"><form onSubmit={onSubmit} className="rounded-3xl border border-cyan-100 bg-white p-6 shadow-[0_16px_42px_rgba(4,66,74,.1)] sm:p-8"><div className="flex items-start gap-3"><div className="rounded-xl bg-[#e4f8f8] p-2.5"><CreditCard className="h-5 w-5 text-[#087f8c]" /></div><div><h2 className="text-xl font-black text-[#062634]">Registration details</h2><p className="mt-1 text-sm leading-6 text-slate-500">Your details create the Expo record used for tickets and future event information.</p></div></div>
            {selectedPackage && <div className="mt-6 rounded-xl bg-[#f0fbfc] p-4"><p className="text-xs font-black uppercase tracking-[.16em] text-[#087f8c]">Selected option</p><p className="mt-1 font-black text-[#062634]">{selectedPackage.name}</p><p className="mt-1 text-sm font-bold text-[#087f8c]">{formatExpoMoney(selectedPackage.amountCents, selectedPackage.currency)}</p></div>}
            <div className="mt-6 grid gap-4"><label className="grid gap-1.5 text-sm font-bold text-slate-700">{businessFields ? "Primary contact name" : "Registrant name"}<input required value={form.attendeeName} onChange={e => update("attendeeName", e.target.value)} autoComplete="name" className="h-11 rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-[#087f8c] focus:ring-2 focus:ring-[#087f8c]/20" /></label><label className="grid gap-1.5 text-sm font-bold text-slate-700">Email address<input required type="email" value={form.attendeeEmail} onChange={e => update("attendeeEmail", e.target.value)} autoComplete="email" className="h-11 rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-[#087f8c] focus:ring-2 focus:ring-[#087f8c]/20" /></label><label className="grid gap-1.5 text-sm font-bold text-slate-700">Phone <span className="font-normal text-slate-400">(optional)</span><input value={form.attendeePhone} onChange={e => update("attendeePhone", e.target.value)} autoComplete="tel" className="h-11 rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-[#087f8c] focus:ring-2 focus:ring-[#087f8c]/20" /></label>{businessFields && <><label className="grid gap-1.5 text-sm font-bold text-slate-700">Organization name<input required value={form.organizationName} onChange={e => update("organizationName", e.target.value)} autoComplete="organization" className="h-11 rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-[#087f8c] focus:ring-2 focus:ring-[#087f8c]/20" /></label><label className="grid gap-1.5 text-sm font-bold text-slate-700">Organization website <span className="font-normal text-slate-400">(optional)</span><input type="url" placeholder="https://" value={form.organizationWebsite} onChange={e => update("organizationWebsite", e.target.value)} className="h-11 rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-[#087f8c] focus:ring-2 focus:ring-[#087f8c]/20" /></label></>}<label className="grid gap-1.5 text-sm font-bold text-slate-700">Notes <span className="font-normal text-slate-400">(optional)</span><textarea value={form.notes} onChange={e => update("notes", e.target.value)} rows={3} className="rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none transition focus:border-[#087f8c] focus:ring-2 focus:ring-[#087f8c]/20" /></label></div>
            {checkout.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{checkout.error.message}</p>}
            <Button disabled={!selectedPackage || checkout.isPending} className="mt-6 h-12 w-full bg-[#0c9ba3] text-base font-bold hover:bg-[#0a858d] disabled:opacity-60">{checkout.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening secure checkout…</> : <>Continue to secure payment <ArrowRight className="ml-2 h-4 w-4" /></>}</Button><p className="mt-4 flex items-center justify-center gap-2 text-center text-xs leading-5 text-slate-500"><LockKeyhole className="h-3.5 w-3.5 shrink-0 text-[#087f8c]" /> Secure checkout is processed by Stripe. Card information is never stored on this site.</p></form></aside>
      </div></main>
  </div>;
}
