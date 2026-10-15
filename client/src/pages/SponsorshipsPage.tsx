import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  formatSponsorshipAmount,
  SPONSORSHIP_SCOPE_LABELS,
  SPONSORSHIP_TIERS,
  type SponsorshipScope,
  type SponsorshipTier,
} from "@shared/sponsorship";
import { Award, Building2, Check, CircleDollarSign, HeartHandshake, ImagePlus, Loader2, MapPin, Megaphone, MonitorSmartphone, PartyPopper, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const TIER_ORDER: SponsorshipTier[] = ["silver", "gold", "platinum", "other"];
const SCOPE_ORDER: SponsorshipScope[] = ["workshop_instance", "website", "app", "podcast", "other"];

function amountFromDollars(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function workshopLabel(instance: any): string {
  const date = instance.startDate
    ? new Date(instance.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Date to be announced";
  const location = [instance.venueCity, instance.venueState].filter(Boolean).join(", ");
  return `${instance.workshopTitle} — ${instance.title} · ${date}${location ? ` · ${location}` : ""}`;
}

export default function SponsorshipsPage() {
  const [tier, setTier] = useState<SponsorshipTier>("gold");
  const [scope, setScope] = useState<SponsorshipScope>("workshop_instance");
  const [customAmount, setCustomAmount] = useState("");
  const [workshopInstanceId, setWorkshopInstanceId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationWebsite, setOrganizationWebsite] = useState("");
  const [organizationLogo, setOrganizationLogo] = useState<{ dataUri: string; mimeType: string; fileName: string } | null>(null);
  const [otherPurpose, setOtherPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const status = new URLSearchParams(window.location.search).get("status");

  const instancesQuery = trpc.sponsorship.listWorkshopInstances.useQuery();
  const checkout = trpc.sponsorship.createCheckout.useMutation({
    onError: (error) => toast.error(error.message || "We could not begin secure checkout. Please try again."),
  });

  const amountCents = useMemo(
    () => tier === "other" ? amountFromDollars(customAmount) : SPONSORSHIP_TIERS[tier].amountCents ?? 0,
    [customAmount, tier],
  );

  const startCheckout = async () => {
    if (!contactName.trim() || !contactEmail.trim() || !organizationName.trim()) {
      toast.error("Enter your name, organization, and email to continue.");
      return;
    }
    if (scope === "workshop_instance" && !workshopInstanceId) {
      toast.error("Choose the workshop instance your organization would like to support.");
      return;
    }
    if (scope === "other" && !otherPurpose.trim()) {
      toast.error("Describe the sponsorship you would like to support.");
      return;
    }
    if (tier === "other" && amountCents < 100) {
      toast.error("Enter a support amount of at least $1.00.");
      return;
    }

    const result = await checkout.mutateAsync({
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim() || undefined,
      organizationName: organizationName.trim(),
      organizationWebsite: organizationWebsite.trim() || undefined,
      organizationLogoDataUri: organizationLogo?.dataUri,
      organizationLogoMimeType: organizationLogo?.mimeType,
      organizationLogoFileName: organizationLogo?.fileName,
      tier,
      scope,
      workshopInstanceId: scope === "workshop_instance" ? Number(workshopInstanceId) : undefined,
      otherPurpose: scope === "other" ? otherPurpose.trim() : undefined,
      customAmountCents: tier === "other" ? amountCents : undefined,
      notes: notes.trim() || undefined,
      origin: window.location.origin,
    });
    const opened = window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
    if (!opened) window.location.assign(result.checkoutUrl);
  };

  return (
    <main className="min-h-screen bg-[#f3fdfe] text-slate-800">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#063f4b] via-[#087988] to-[#18a6b2] px-4 py-16 sm:py-20">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 15% 20%, #bff7f5 0, transparent 28%), radial-gradient(circle at 88% 85%, #fff 0, transparent 25%)" }} />
        <div className="relative mx-auto max-w-6xl text-center text-white">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold tracking-wide">
            <HeartHandshake className="h-4 w-4" /> Sponsor ultrasound education
          </div>
          <h1 className="mx-auto max-w-4xl font-serif text-4xl font-bold leading-tight sm:text-5xl">Partner with All About Ultrasound™ | iHeartEcho™</h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-cyan-50 sm:text-lg">Support the education, tools, and hands-on experiences that help ultrasound professionals deliver confident, informed care.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        {status === "complete" && (
          <div className="mb-9 flex items-start gap-3 rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
            <PartyPopper className="mt-0.5 h-6 w-6 shrink-0 text-teal-600" />
            <div><h2 className="font-semibold text-teal-900">Thank you for your support.</h2><p className="mt-1 text-sm leading-6 text-slate-600">Your sponsorship payment was received. A confirmation is on its way, and our team will follow up about recognition details.</p></div>
          </div>
        )}
        {status === "cancelled" && <div className="mb-9 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">Your sponsorship checkout was not completed. Your selections are still here if you would like to try again.</div>}

        <div className="mb-12 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.17em] text-teal-700">Sponsorship recognition</p>
          <h2 className="mt-2 font-serif text-3xl font-bold text-slate-900">Choose the level that fits your organization</h2>
          <p className="mx-auto mt-3 max-w-3xl text-slate-600">Recognition is coordinated after payment to make sure your organization is represented accurately across the selected opportunity.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {TIER_ORDER.map((key) => {
            const entry = SPONSORSHIP_TIERS[key];
            const selected = tier === key;
            return (
              <button key={key} type="button" onClick={() => setTier(key)} className={`group rounded-2xl border p-6 text-left transition-all duration-200 ${selected ? "border-teal-500 bg-white shadow-lg ring-2 ring-teal-100" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"}`}>
                <div className="flex items-start justify-between gap-3"><div><p className="font-serif text-2xl font-bold text-slate-900">{entry.label}</p><p className="mt-1 text-lg font-bold text-teal-700">{entry.amountCents ? formatSponsorshipAmount(entry.amountCents) : "Your amount"}</p></div>{selected && <span className="rounded-full bg-teal-600 p-1 text-white"><Check className="h-3.5 w-3.5" /></span>}</div>
                <p className="mt-4 min-h-14 text-sm leading-5 text-slate-600">{entry.description}</p>
                <ul className="mt-5 space-y-2.5">{entry.benefits.map((benefit) => <li key={benefit} className="flex gap-2 text-xs leading-5 text-slate-600"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />{benefit}</li>)}</ul>
              </button>
            );
          })}
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-3"><CircleDollarSign className="mt-1 h-6 w-6 text-teal-600" /><div><h2 className="font-serif text-2xl font-bold text-slate-900">Sponsorship application</h2><p className="mt-1 text-sm leading-6 text-slate-600">Tell us where your support will make the biggest impact, then continue to secure Stripe checkout.</p></div></div>
            <div className="mt-8 space-y-7">
              <fieldset><legend className="text-sm font-semibold text-slate-900">What would you like to support?</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{SCOPE_ORDER.map((option) => <label key={option} className={`cursor-pointer rounded-xl border p-4 transition-colors ${scope === option ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-teal-300"}`}><input className="sr-only" type="radio" name="scope" value={option} checked={scope === option} onChange={() => setScope(option)} /><span className="block text-sm font-semibold text-slate-800">{SPONSORSHIP_SCOPE_LABELS[option]}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{option === "workshop_instance" ? "Support a scheduled, hands-on learning experience." : option === "website" ? "Support the public education website experience." : option === "app" ? "Support ultrasound clinical intelligence app access and development." : option === "podcast" ? "Support Sonographer’s After Dark podcast education and community conversations." : "Support an opportunity not listed above."}</span></label>)}</div></fieldset>

              {scope === "workshop_instance" && <div className="space-y-2"><Label htmlFor="sponsor-workshop">Workshop instance</Label><select id="sponsor-workshop" value={workshopInstanceId} onChange={(event) => setWorkshopInstanceId(event.target.value)} className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"><option value="">Select a workshop instance</option>{(instancesQuery.data ?? []).map((instance: any) => <option key={instance.id} value={instance.id}>{workshopLabel(instance)}</option>)}</select>{instancesQuery.isLoading && <p className="text-xs text-slate-500">Loading available workshop instances…</p>}</div>}
              {scope === "other" && <div className="space-y-2"><Label htmlFor="other-purpose">Describe the sponsorship</Label><Input id="other-purpose" value={otherPurpose} onChange={(event) => setOtherPurpose(event.target.value)} placeholder="Example: scholarship fund or a future event" /></div>}
              {tier === "other" && <div className="space-y-2"><Label htmlFor="custom-amount">Your support amount (USD)</Label><Input id="custom-amount" type="number" min="1" step="0.01" inputMode="decimal" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} placeholder="0.00" /></div>}

              <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="contact-name">Contact name</Label><Input id="contact-name" value={contactName} onChange={(event) => setContactName(event.target.value)} autoComplete="name" /></div><div className="space-y-2"><Label htmlFor="organization">Organization</Label><Input id="organization" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} autoComplete="organization" /></div><div className="space-y-2"><Label htmlFor="contact-email">Email</Label><Input id="contact-email" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} autoComplete="email" /></div><div className="space-y-2"><Label htmlFor="contact-phone">Phone <span className="font-normal text-slate-400">(optional)</span></Label><Input id="contact-phone" type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} autoComplete="tel" /></div></div>
              <div className="space-y-2"><Label htmlFor="organization-website">Organization website <span className="font-normal text-slate-400">(optional)</span></Label><Input id="organization-website" type="url" value={organizationWebsite} onChange={(event) => setOrganizationWebsite(event.target.value)} placeholder="https://" autoComplete="url" /></div>
              <div className="space-y-2"><Label htmlFor="organization-logo">Organization logo <span className="font-normal text-slate-400">(optional, PNG, JPEG, or WebP; up to 3 MB)</span></Label><div className="flex flex-wrap items-center gap-3">{organizationLogo ? <><img src={organizationLogo.dataUri} alt="Organization logo preview" className="h-14 w-14 rounded border border-slate-200 bg-white object-contain p-1" /><span className="max-w-[240px] truncate text-sm text-slate-600">{organizationLogo.fileName}</span><Button type="button" variant="outline" size="sm" onClick={() => setOrganizationLogo(null)}><X className="mr-1 h-3.5 w-3.5" />Remove</Button></> : <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-teal-700 shadow-sm transition hover:bg-teal-50"><ImagePlus className="h-4 w-4" />Upload logo<input id="organization-logo" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (!file) return; if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 3 * 1024 * 1024) { toast.error("Choose a PNG, JPEG, or WebP logo no larger than 3 MB."); return; } const reader = new FileReader(); reader.onload = () => setOrganizationLogo({ dataUri: String(reader.result), mimeType: file.type, fileName: file.name }); reader.readAsDataURL(file); }} /></label>}</div></div>
              <div className="space-y-2"><Label htmlFor="sponsor-notes">Recognition or coordination notes <span className="font-normal text-slate-400">(optional)</span></Label><Textarea id="sponsor-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Share any recognition preferences, campaign timing, or questions." rows={4} /></div>
            </div>
          </section>

          <aside className="h-fit rounded-2xl bg-[#073f4b] p-6 text-white shadow-xl sm:p-8 lg:sticky lg:top-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">Your commitment</p>
            <div className="mt-5 border-b border-white/15 pb-5"><p className="font-serif text-3xl font-bold">{SPONSORSHIP_TIERS[tier].label}</p><p className="mt-1 text-3xl font-bold text-cyan-200">{amountCents > 0 ? formatSponsorshipAmount(amountCents) : "Choose amount"}</p></div>
            <div className="space-y-4 py-6 text-sm">{organizationLogo && <img src={organizationLogo.dataUri} alt="Organization logo preview" className="h-14 w-14 rounded bg-white object-contain p-1" />}<div className="flex gap-3"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /><span>{organizationName.trim() || "Your organization"}</span></div><div className="flex gap-3"><Award className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /><span>{SPONSORSHIP_SCOPE_LABELS[scope]}</span></div>{scope === "workshop_instance" && workshopInstanceId && <div className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /><span>{workshopLabel((instancesQuery.data ?? []).find((instance: any) => String(instance.id) === workshopInstanceId))}</span></div>}</div>
            <Button className="h-12 w-full bg-[#15a1ae] text-base font-semibold text-white shadow-lg transition hover:bg-[#0b8794] active:scale-[0.98]" onClick={startCheckout} disabled={checkout.isPending}>{checkout.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing secure checkout…</> : <>Continue to secure payment <span aria-hidden="true">→</span></>}</Button>
            <p className="mt-4 text-center text-xs leading-5 text-cyan-100">Payments are securely processed by Stripe. A receipt and sponsorship thank-you are sent after payment completes.</p>
          </aside>
        </div>

        <section className="mt-14 grid gap-5 md:grid-cols-3"><div className="rounded-2xl bg-white p-6 shadow-sm"><MonitorSmartphone className="h-7 w-7 text-teal-600" /><h3 className="mt-4 font-semibold text-slate-900">Digital recognition</h3><p className="mt-2 text-sm leading-6 text-slate-600">Website, app, and social recognition are tailored to the sponsorship level and support opportunity.</p></div><div className="rounded-2xl bg-white p-6 shadow-sm"><Users className="h-7 w-7 text-teal-600" /><h3 className="mt-4 font-semibold text-slate-900">Learner impact</h3><p className="mt-2 text-sm leading-6 text-slate-600">Your sponsorship directly supports trusted resources, hands-on education, and professional development.</p></div><div className="rounded-2xl bg-white p-6 shadow-sm"><Megaphone className="h-7 w-7 text-teal-600" /><h3 className="mt-4 font-semibold text-slate-900">Thoughtful coordination</h3><p className="mt-2 text-sm leading-6 text-slate-600">Our team confirms benefit timing and materials so every recognition detail is accurate and useful.</p></div></section>
      </section>
    </main>
  );
}
