import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, CalendarDays, ChevronDown, CircleCheck, Handshake, MapPin, Menu, MonitorPlay, Network, ScanLine, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ULTRASOUND_EXPO_AAUS_LOGO_URL, ULTRASOUND_EXPO_HERO_IMAGE, ULTRASOUND_EXPO_NAME, ULTRASOUND_EXPO_ORGANIZER } from "@shared/ultrasoundExpo";

const NAVIGATION = [
  { label: "Attend", href: "/attend" },
  { label: "Exhibit", href: "/exhibit" },
  { label: "Sponsor", href: "/sponsor" },
  { label: "Program", href: "/program" },
  { label: "Expo", href: "/expo" },
  { label: "Connect", href: "/connect" },
  { label: "About", href: "/about" },
];

const EXPERIENCES = [
  [ScanLine, "Technology", "Explore the technology, devices, AI, workflow tools, and new ideas moving ultrasound forward."],
  [Users, "Hands-On Learning", "Build practical confidence through ScanLabs, workshops, live demonstrations, and specialty training."],
  [Sparkles, "CME Education", "Plan a learning experience built around the sessions and credentials that matter to your practice."],
  [MonitorPlay, "Innovation", "See product launches, the Innovation Stage, Startup Row, and ultrasound's next chapter."],
  [Network, "Careers", "Meet recruiters, explore industry roles, and grow the professional network behind your next move."],
  [Handshake, "Community", "Connect with sonographers, physicians, educators, leaders, and the teams who serve them."],
] as const;

function formatDateRange(start?: Date | string | null, end?: Date | string | null) {
  if (!start) return "Dates to be announced";
  const startDate = new Date(start);
  const options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };
  const startText = startDate.toLocaleDateString("en-US", options);
  if (!end) return startText;
  const endDate = new Date(end);
  return `${startText} – ${endDate.toLocaleDateString("en-US", options)}`;
}

function ExpoHeader() {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#061e2a]/95 text-white backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-5 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-[#66d4d2]/50 bg-white shadow-lg shadow-cyan-950/40">
            <img src={ULTRASOUND_EXPO_AAUS_LOGO_URL} alt="All About Ultrasound™ SonoRing logo" className="h-full w-full object-contain p-0.5" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-lg font-black tracking-[-0.04em]">Ultrasound<span className="text-[#6be1dc]">Expo™</span></span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300">by All About Ultrasound™</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {NAVIGATION.map(item => <Link key={item.href} href={item.href} className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${location === item.href ? "bg-white/10 text-[#8aeae5]" : "text-slate-200 hover:bg-white/10 hover:text-white"}`}>{item.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-2 sm:flex">
          <Link href="/expo-dashboard" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#a5f4ef] hover:bg-white/10">My Expo</Link>
          <Button onClick={() => setLocation("/register?type=registrant")} className="bg-[#0c9ba3] font-bold hover:bg-[#0a858d]">Register to Attend</Button>
        </div>
        <button onClick={() => setOpen(!open)} className="rounded-lg p-2 text-white hover:bg-white/10 lg:hidden" aria-label="Toggle menu">{open ? <X /> : <Menu />}</button>
      </div>
      {open && <div className="border-t border-white/10 px-4 py-3 lg:hidden"><nav className="grid gap-1">{NAVIGATION.map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-100 hover:bg-white/10">{item.label}</Link>)}<Link href="/expo-dashboard" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold text-[#8aeae5]">My Expo Dashboard</Link><Button onClick={() => { setOpen(false); setLocation("/register?type=registrant"); }} className="mt-2 bg-[#0c9ba3]">Register to Attend</Button></nav></div>}
    </header>
  );
}

function InfoPage({ page, event }: { page: string; event: any }) {
  const content: Record<string, { eyebrow: string; title: string; body: string; cta: string; type?: string }> = {
    attend: { eyebrow: "Attend UltrasoundExpo™", title: "Your entire ultrasound community, in one place.", body: "Registration packages, education, ScanLabs, career opportunities, networking, and event details will be organized around the annual Expo. Registration options are released and managed from the Expo team dashboard.", cta: "View registration options", type: "registrant" },
    exhibit: { eyebrow: "Exhibit at UltrasoundExpo™", title: "Put your technology in front of the ultrasound professionals who use it.", body: "Exhibitor opportunities are separate from All About Ultrasound and iHeartEcho programs. Expo packages, application workflow, booth availability, and exhibitor resources will live in this annual event platform.", cta: "Explore exhibitor opportunities", type: "exhibitor" },
    sponsor: { eyebrow: "Sponsor UltrasoundExpo™", title: "Build a visible partnership at the industry's gathering place.", body: "Expo sponsorships are event-specific. The organizer can publish available opportunities, inventory, benefits, and pricing in a dedicated marketplace — distinct from the established All About Ultrasound™ | iHeartEcho™ sponsorship program.", cta: "See sponsorship opportunities", type: "sponsor" },
    program: { eyebrow: "The Program", title: "Technology. Education. Innovation. Careers. Community.", body: "The annual program will feature specialty education, ScanLabs, workshops, Innovation Stage programming, career development, and professional connection. CME classifications will be clearly designated by administrators before sessions are presented as accredited.", cta: "Register to attend", type: "registrant" },
    expo: { eyebrow: "The Expo Floor", title: "Explore the future of ultrasound.", body: "The Expo will bring together manufacturers, AI and software teams, education companies, recruiters, professional organizations, startups, and specialized clinical innovators. An exhibitor directory and event floor plan will be published as the inaugural event is built.", cta: "Become an exhibitor", type: "exhibitor" },
    connect: { eyebrow: "Connect", title: "Build the network behind your next opportunity.", body: "UltrasoundExpo™ is being designed as a national meeting place for clinical professionals, students, educators, employers, innovators, and industry partners — including Careers LIVE and dedicated networking experiences.", cta: "Join the Expo", type: "registrant" },
    about: { eyebrow: "About UltrasoundExpo™", title: "An annual event for everything ultrasound.", body: `${ULTRASOUND_EXPO_NAME} is organized by ${ULTRASOUND_EXPO_ORGANIZER}. It is designed as a scalable annual event environment — with a dedicated public site, expo dashboards, shared member sign-in, and distinct registration, exhibitor, and sponsorship records.`, cta: "Explore the experience", type: "registrant" },
  };
  const current = content[page] ?? content.about;
  return <main className="min-h-screen bg-[#f6fbfc]"><section className="bg-[#062634] px-4 py-20 text-white sm:px-6"><div className="mx-auto max-w-4xl"><p className="mb-4 text-xs font-black uppercase tracking-[0.23em] text-[#6be1dc]">{current.eyebrow}</p><h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.045em] sm:text-6xl">{current.title}</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-slate-200">{current.body}</p><Link href={`/register?type=${current.type ?? "registrant"}`} className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#0c9ba3] px-5 py-3 font-bold text-white shadow-xl shadow-cyan-950/30 hover:bg-[#0a858d]">{current.cta}<ArrowRight className="h-4 w-4" /></Link></div></section><section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-3 sm:px-6"><div className="rounded-2xl border border-cyan-100 bg-white p-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#087f8c]">Next event</p><p className="mt-2 text-xl font-black text-slate-900">{event?.name ?? "UltrasoundExpo™ 2028"}</p><p className="mt-2 text-sm text-slate-600">{formatDateRange(event?.startsAt, event?.endsAt)}</p></div><div className="rounded-2xl border border-cyan-100 bg-white p-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#087f8c]">Venue</p><p className="mt-2 text-xl font-black text-slate-900">{event?.locationLabel ?? "Location to be announced"}</p><p className="mt-2 text-sm text-slate-600">Updated event logistics will be published here.</p></div><div className="rounded-2xl border border-cyan-100 bg-white p-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#087f8c]">Questions</p><a className="mt-2 block text-xl font-black text-slate-900 hover:text-[#087f8c]" href="mailto:support@allaboutultrasound.com">Support team</a><p className="mt-2 text-sm text-slate-600">support@allaboutultrasound.com</p></div></section></main>;
}

export default function UltrasoundExpoSite() {
  const [location] = useLocation();
  const { data, isLoading } = trpc.ultrasoundExpo.publicLaunch.useQuery();
  const page = location === "/" ? "home" : location.split("/")[1]?.split("?")[0] ?? "home";
  const event = data?.event;
  const packagesByType = useMemo(() => new Map((data?.packages ?? []).map(p => [p.packageType, p])), [data?.packages]);
  if (page !== "home") return <><ExpoHeader /><InfoPage page={page} event={event} /></>;
  return <div className="min-h-screen bg-[#f6fbfc] text-slate-900"><ExpoHeader />
    <main>
      <section className="relative isolate overflow-hidden bg-[#052331] text-white"><img src={event?.heroImageUrl || ULTRASOUND_EXPO_HERO_IMAGE} alt="Professionals exploring ultrasound technology at an Expo" className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-55" /><div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(2,21,31,.96)_0%,rgba(3,30,42,.87)_42%,rgba(4,54,62,.28)_100%)]" />
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:py-40"><div className="max-w-3xl"><p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#72e1de]/45 bg-[#07626b]/35 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#a9f7f2]"><Sparkles className="h-3.5 w-3.5" /> Annual national ultrasound event</p><h1 className="text-5xl font-black leading-[.96] tracking-[-0.06em] sm:text-7xl lg:text-8xl">Everything Ultrasound.<br/><span className="text-[#72e1de]">One Place.</span></h1><p className="mt-7 max-w-2xl text-lg leading-8 text-slate-100 sm:text-xl">Experience the technology, education, hands-on training, career opportunities, and innovation shaping the future of ultrasound.</p><div className="mt-9 flex flex-wrap gap-3"><Button onClick={() => window.location.assign("/register?type=registrant")} className="h-12 bg-[#0c9ba3] px-6 text-base font-bold shadow-xl shadow-cyan-950/40 hover:bg-[#0a858d]">Register Now <ArrowRight className="ml-2 h-4 w-4" /></Button><Button onClick={() => window.location.assign("/register?type=exhibitor")} variant="outline" className="h-12 border-white/55 bg-white/10 px-6 text-base font-bold text-white hover:bg-white hover:text-[#062634]">Exhibit at UltrasoundExpo™</Button></div></div></div>
      </section>
      <section className="border-b border-cyan-100 bg-white"><div className="mx-auto grid max-w-7xl divide-y divide-cyan-100 sm:grid-cols-4 sm:divide-x sm:divide-y-0"><div className="p-5"><span className="block text-[10px] font-black uppercase tracking-[.18em] text-[#087f8c]">Event date</span><span className="mt-1 block font-bold text-slate-900">{isLoading ? "Loading event…" : formatDateRange(event?.startsAt, event?.endsAt)}</span></div><div className="p-5"><span className="block text-[10px] font-black uppercase tracking-[.18em] text-[#087f8c]">City / venue</span><span className="mt-1 block font-bold text-slate-900">{event?.locationLabel ?? "To be announced"}</span></div><div className="p-5"><span className="block text-[10px] font-black uppercase tracking-[.18em] text-[#087f8c]">Attendee registration</span><span className="mt-1 block font-bold text-slate-900">{packagesByType.has("registrant") ? "Open" : "Details coming soon"}</span></div><div className="p-5"><span className="block text-[10px] font-black uppercase tracking-[.18em] text-[#087f8c]">Exhibitor registration</span><span className="mt-1 block font-bold text-slate-900">{packagesByType.has("exhibitor") ? "Open" : "Applications opening soon"}</span></div></div></section>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><p className="text-center text-xs font-black uppercase tracking-[.22em] text-[#087f8c]">A national meeting place</p><h2 className="mx-auto mt-3 max-w-3xl text-center text-3xl font-black tracking-[-.04em] text-[#062634] sm:text-5xl">One event. The entire ultrasound community.</h2><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{EXPERIENCES.map(([Icon, title, text]) => <div key={title} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_36px_rgba(10,68,76,.06)] transition-transform hover:-translate-y-1"><Icon className="h-7 w-7 text-[#087f8c]" /><h3 className="mt-5 text-xl font-black text-[#062634]">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p><ChevronDown className="mt-5 h-4 w-4 -rotate-90 text-[#087f8c]" /></div>)}</div></section>
      <section className="bg-[#e8f7f8] px-4 py-20 sm:px-6"><div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_.95fr] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#087f8c]">Experience the Expo floor</p><h2 className="mt-3 text-4xl font-black tracking-[-.05em] text-[#062634] sm:text-5xl">Meet the teams building what comes next.</h2><p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">Explore ultrasound manufacturers, technologies, AI solutions, workflow tools, education platforms, career opportunities, accessories, medical devices, software, and emerging ultrasound innovations.</p><Link href="/expo" className="mt-7 inline-flex items-center gap-2 font-bold text-[#087f8c] hover:text-[#065f68]">Explore exhibitors <ArrowRight className="h-4 w-4" /></Link></div><div className="rounded-[2rem] bg-[#062b3a] p-8 text-white shadow-2xl shadow-cyan-900/20"><p className="text-xs font-black uppercase tracking-[.18em] text-[#80eee8]">Designed to grow</p><div className="mt-6 space-y-5">{[[CalendarDays, "Annual event platform", "Future Expo years are managed as separate events — not a rebuild."],[ShieldCheck, "Shared sign-in, separate experience", "Members use the same credentials while Expo registrations and dashboards stay isolated."],[MapPin, "Live details when ready", "Venue, travel, agenda, pricing, and announcements are maintained per event."]].map(([Icon, title, text]) => <div key={String(title)} className="flex gap-4"><div className="mt-0.5 rounded-lg bg-white/10 p-2"><Icon className="h-5 w-5 text-[#80eee8]" /></div><div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-300">{text}</p></div></div>)}</div></div></div></section>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><div className="grid gap-8 md:grid-cols-2"><div className="rounded-3xl bg-[#062b3a] p-8 text-white"><p className="text-xs font-black uppercase tracking-[.2em] text-[#80eee8]">Get hands-on</p><h2 className="mt-3 text-3xl font-black tracking-[-.04em]">ScanLabs, workshops, and skills that translate.</h2><p className="mt-4 leading-7 text-slate-300">As programming is published, administrators can manage event-specific hands-on experiences, capacity, waitlists, and CME designations from the Expo platform.</p><Link href="/program" className="mt-6 inline-flex items-center gap-2 font-bold text-[#80eee8]">Explore the program <ArrowRight className="h-4 w-4" /></Link></div><div className="rounded-3xl bg-[#0c9ba3] p-8 text-white"><p className="text-xs font-black uppercase tracking-[.2em] text-white/75">Founding industry partners</p><h2 className="mt-3 text-3xl font-black tracking-[-.04em]">Create a presence at the ultrasound industry's new annual meeting.</h2><p className="mt-4 leading-7 text-white/85">Expo sponsorships and exhibits are distinct, event-specific opportunities with separate reporting and fulfillment.</p><Link href="/sponsor" className="mt-6 inline-flex items-center gap-2 font-bold text-white">Partner with the Expo <ArrowRight className="h-4 w-4" /></Link></div></div></section>
    </main><footer className="bg-[#041a25] px-4 py-12 text-slate-300 sm:px-6"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 sm:flex-row"><div><p className="text-xl font-black text-white">Ultrasound<span className="text-[#76e5df]">Expo™</span></p><p className="mt-2 text-sm">Everything Ultrasound. One Place.</p><p className="mt-1 text-xs text-slate-400">Organized by All About Ultrasound™</p></div><div className="flex gap-6 text-sm"><Link href="/about" className="hover:text-white">About</Link><Link href="/attend" className="hover:text-white">Attend</Link><Link href="/exhibit" className="hover:text-white">Exhibit</Link><a href="mailto:support@allaboutultrasound.com" className="hover:text-white">Contact</a></div></div></footer>
  </div>;
}
