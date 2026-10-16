import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Building2, CheckCircle2, FileText, ImagePlus, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { VENDOR_PARTNER_SCOPE_LABELS, VENDOR_PARTNER_TYPE_LABELS, type VendorPartnerScope, type VendorPartnerType } from "@shared/vendorPartner";

const scopes: VendorPartnerScope[] = ["aaus_ihe", "ultrasound_expo"];
const partnerTypes: VendorPartnerType[] = ["vendor", "exhibitor", "sponsor"];

function queryDefaults(location: string) {
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const scope = params.get("scope") as VendorPartnerScope | null;
  const type = params.get("type") as VendorPartnerType | null;
  const eventFocus: "" | "ultrasound_expo" | "echo_expo" = params.get("event") === "echoexpo" ? "echo_expo" : params.get("event") === "ultrasoundexpo" ? "ultrasound_expo" : "";
  return {
    scopes: scope && scopes.includes(scope) ? [scope] : ["aaus_ihe", "ultrasound_expo"] as VendorPartnerScope[],
    types: type && partnerTypes.includes(type) ? [type] : ["vendor"] as VendorPartnerType[],
    eventFocus,
  };
}

export default function PartnerApplication() {
  const [location] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const defaults = useMemo(() => queryDefaults(location), [location]);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationWebsite, setOrganizationWebsite] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [message, setMessage] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<VendorPartnerScope[]>(defaults.scopes);
  const [selectedTypes, setSelectedTypes] = useState<VendorPartnerType[]>(defaults.types);
  const [eventFocus, setEventFocus] = useState<"" | "ultrasound_expo" | "echo_expo">(defaults.eventFocus);
  const [logo, setLogo] = useState<{ dataUri: string; mimeType: string; fileName: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!user) return;
    setContactEmail(current => current || user.email || "");
    setContactName(current => current || user.name || "");
  }, [user]);
  const participationCta = selectedTypes.length === 1 && selectedTypes[0] === "exhibitor"
    ? "Sign Up to Exhibit Now"
    : selectedTypes.length === 1 && selectedTypes[0] === "sponsor"
      ? "Start Your Sponsorship Application"
      : selectedTypes.length === 1 && selectedTypes[0] === "vendor"
        ? "Become a Vendor Partner"
        : "Start Your Partner Application";
  const submit = trpc.vendorPortal.submitApplication.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: error => toast.error(error.message || "We could not send your application. Please try again."),
  });

  const toggleScope = (scope: VendorPartnerScope) => setSelectedScopes(previous => previous.includes(scope) ? previous.filter(value => value !== scope) : [...previous, scope]);
  const toggleType = (type: VendorPartnerType) => setSelectedTypes(previous => previous.includes(type) ? previous.filter(value => value !== type) : [...previous, type]);
  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedScopes.length || !selectedTypes.length) {
      toast.error("Choose at least one partner area and partner type.");
      return;
    }
    submit.mutate({
      organizationName,
      organizationWebsite: organizationWebsite || undefined,
      organizationLogoDataUri: logo?.dataUri,
      organizationLogoMimeType: logo?.mimeType,
      organizationLogoFileName: logo?.fileName,
      contactName,
      contactEmail,
      contactPhone,
      message: message || undefined,
      requestedScopes: selectedScopes,
      partnerTypes: selectedTypes,
      eventFocus: eventFocus || undefined,
    });
  };

  return <main className="min-h-screen bg-[#f4fbfc] px-4 py-10 text-slate-900 sm:py-16">
    <div className="mx-auto max-w-5xl">
      <Link href="/" className="text-sm font-bold text-[#087f8c] hover:underline">← Back to the site</Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
        <section className="rounded-3xl bg-[#062b3a] p-7 text-white shadow-xl sm:p-10">
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#7ce9e3]">Partner application</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-.05em]">Begin a partnership with confidence.</h1>
          <p className="mt-5 text-lg leading-8 text-slate-200">Apply once to be reviewed for All About Ultrasound™ | iHeartEcho™ opportunities, UltrasoundExpo™ and EchoExpo™ opportunities, or both. We’ll notify you after reviewing your contact information and organizational details.</p>
          <div className="mt-9 space-y-4 border-t border-white/15 pt-7 text-sm leading-6 text-slate-200">
            <p className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#7ce9e3]" /> No payment details are collected on this form.</p>
            <p className="flex gap-3"><FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#7ce9e3]" /> The team reviews every organization before portal access is enabled.</p>
            <p className="flex gap-3"><Building2 className="mt-0.5 h-5 w-5 shrink-0 text-[#7ce9e3]" /> Approved access uses the same shared account credentials across connected platforms.</p>
          </div>
          <p className="mt-8 text-sm text-slate-300">Questions? <a className="font-bold text-[#8feee9] hover:underline" href="mailto:support@allaboutultrasound.com">support@allaboutultrasound.com</a></p>
        </section>
        <section className="rounded-3xl border border-cyan-100 bg-white p-6 shadow-[0_16px_42px_rgba(4,66,74,.1)] sm:p-8">
          {submitted ? <div className="py-10 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100"><CheckCircle2 className="h-7 w-7 text-emerald-700" /></div><h2 className="mt-6 text-2xl font-black text-[#062634]">Application received</h2><p className="mx-auto mt-3 max-w-md leading-7 text-slate-600">Thank you. The team has been alerted and will review your organization. We will email next steps after the application is approved.</p><Link href="/" className="mt-7 inline-flex font-bold text-[#087f8c] hover:underline">Return to the site</Link></div> : <form onSubmit={onSubmit} className="space-y-6"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#087f8c]">Organization details</p><h2 className="mt-2 text-2xl font-black tracking-[-.035em] text-[#062634]">Tell us about your organization</h2></div>
            {isAuthenticated && !authLoading && <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm leading-6 text-slate-700"><strong className="text-[#062634]">Shared Learn account detected.</strong> Submit with your account email to keep your future attendee registration and approved exhibitor access connected to this same profile.</div>}
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Organization name"><Input required value={organizationName} onChange={e => setOrganizationName(e.target.value)} autoComplete="organization" /></Field><Field label="Organization website (optional)"><Input type="text" inputMode="url" value={organizationWebsite} onChange={e => setOrganizationWebsite(e.target.value)} placeholder="yourorganization.com" autoComplete="url" /></Field><Field label="Contact name"><Input required value={contactName} onChange={e => setContactName(e.target.value)} autoComplete="name" /></Field><Field label="Email address"><Input required type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} autoComplete="email" /></Field><Field label="Phone"><Input required type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} autoComplete="tel" /></Field><Field label="Organization logo"><div className="flex items-center gap-3"><label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-bold text-[#087f8c] hover:bg-cyan-50"><ImagePlus className="h-4 w-4" />{logo ? "Replace logo" : "Upload logo"}<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (!file) return; if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 3 * 1024 * 1024) { toast.error("Choose a PNG, JPEG, or WebP logo no larger than 3 MB."); return; } const reader = new FileReader(); reader.onload = () => setLogo({ dataUri: String(reader.result), mimeType: file.type, fileName: file.name }); reader.readAsDataURL(file); }} /></label>{logo && <span className="max-w-[160px] truncate text-xs text-slate-500">{logo.fileName}</span>}</div></Field></div>
            <fieldset><legend className="text-sm font-bold text-slate-700">Where would you like to participate?</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{scopes.map(scope => <label key={scope} className={`cursor-pointer rounded-xl border p-4 transition ${selectedScopes.includes(scope) ? "border-[#087f8c] bg-[#ebfbfb]" : "border-slate-200 hover:border-cyan-300"}`}><input className="sr-only" type="checkbox" checked={selectedScopes.includes(scope)} onChange={() => toggleScope(scope)} /><span className="block font-bold text-[#062634]">{VENDOR_PARTNER_SCOPE_LABELS[scope]}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{scope === "aaus_ihe" ? "General sponsorship, workshop exhibit, and webinar partner opportunities." : "Annual event exhibit, sponsor, resource, and booth request access."}</span></label>)}</div></fieldset>
            {selectedScopes.includes("ultrasound_expo") && <label className="grid gap-1.5 text-sm font-bold text-slate-700">UltrasoundExpo™ event pathway <select value={eventFocus} onChange={event => setEventFocus(event.target.value as typeof eventFocus)} className="h-10 rounded-md border border-slate-200 bg-white px-3 font-normal"><option value="">UltrasoundExpo™ (general event)</option><option value="echo_expo">EchoExpo™ (cardiac ultrasound / echocardiography)</option></select></label>}
            <fieldset><legend className="text-sm font-bold text-slate-700">How would you like to participate?</legend><p className="mt-1 text-xs leading-5 text-slate-500">Select all that apply. An organization may be a vendor, exhibitor, sponsor, or any combination.</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{partnerTypes.map(type => {
              const details: Record<VendorPartnerType, string> = {
                vendor: "Provides products, services, or solutions for the ultrasound community.",
                exhibitor: "Presents offerings in an event exhibit space or exhibit hall.",
                sponsor: "Supports an event, education, or initiative with brand recognition.",
              };
              const selected = selectedTypes.includes(type);
              return <label key={type} className={`cursor-pointer rounded-xl border p-4 transition ${selected ? "border-[#087f8c] bg-[#ebfbfb] shadow-sm" : "border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/40"}`}><input className="sr-only" type="checkbox" checked={selected} onChange={() => toggleType(type)} /><span className="flex items-center justify-between gap-2"><span className="font-bold text-[#062634]">{VENDOR_PARTNER_TYPE_LABELS[type]}</span><span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded border text-xs font-black ${selected ? "border-[#087f8c] bg-[#087f8c] text-white" : "border-slate-300 bg-white text-transparent"}`}>✓</span></span><span className="mt-2 block text-xs leading-5 text-slate-500">{details[type]}</span></label>;
            })}</div></fieldset>
            <Field label="Message or partnership goals"><Textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell us about your organization, the event or audience you hope to support, and any questions." /></Field>
            <Button disabled={submit.isPending} className="h-12 w-full bg-[#0c9ba3] text-base font-bold hover:bg-[#0a858d]">{submit.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting application…</> : participationCta}</Button>
          </form>}
        </section>
      </div>
    </div>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-bold text-slate-700"><span>{label}</span>{children}</label>; }
