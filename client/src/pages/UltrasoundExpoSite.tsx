import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, CalendarDays, ChevronDown, CircleCheck, Handshake, MapPin, Menu, MonitorPlay, Network, ScanLine, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useSeoHead } from "@/hooks/useSeoHead";
import { ExpoAccountMenu, ExpoMobileAccountLinks } from "@/components/ExpoAccountMenu";
import { getUltrasoundExpoPageSeo, ULTRASOUND_EXPO_EVENT_DATES_LABEL, ULTRASOUND_EXPO_HERO_IMAGE, ULTRASOUND_EXPO_LOCATION_LABEL, ULTRASOUND_EXPO_LOGO_URL, ULTRASOUND_EXPO_NAME, ULTRASOUND_EXPO_ORGANIZER, ULTRASOUND_EXPO_ORIGIN, ULTRASOUND_EXPO_SCHEDULE, ULTRASOUND_EXPO_SITE_DOMAIN } from "@shared/ultrasoundExpo";

const EXHIBITOR_APPLICATION_HREF = "/partner-application?scope=ultrasound_expo&type=exhibitor";

const NAVIGATION = [
  { label: "Attend", href: "/attend" },
  { label: "Exhibit", href: EXHIBITOR_APPLICATION_HREF },
  { label: "Sponsor", href: "/sponsor" },
  { label: "Program", href: "/program" },
  { label: "Exhibit Hall", href: "/expo" },
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
  if (!start) return ULTRASOUND_EXPO_EVENT_DATES_LABEL;
  const startDate = new Date(start);
  const options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" };
  const startText = startDate.toLocaleDateString("en-US", options);
  if (!end) return startText;
  const endDate = new Date(end);
  if (startDate.getUTCFullYear() === endDate.getUTCFullYear() && startDate.getUTCMonth() === endDate.getUTCMonth()) {
    const month = startDate.toLocaleDateString("en-US", { month: "long", timeZone: "America/New_York" });
    const startDay = startDate.toLocaleDateString("en-US", { day: "numeric", timeZone: "America/New_York" });
    const endDay = endDate.toLocaleDateString("en-US", { day: "numeric", timeZone: "America/New_York" });
    return `${month} ${startDay}–${endDay}, ${startDate.getUTCFullYear()}`;
  }
  return `${startText} – ${endDate.toLocaleDateString("en-US", options)}`;
}

function ExpoHeader() {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#061e2a]/95 text-white backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-5 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-3 whitespace-nowrap">
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-[#66d4d2]/50 bg-white shadow-lg shadow-cyan-950/40">
            <img src={ULTRASOUND_EXPO_LOGO_URL} alt="UltrasoundExpo™ logo" className="h-full w-full object-contain p-0.5" />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-black tracking-[-0.04em]">Ultrasound<span className="text-[#6be1dc]">Expo™</span></span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300">by All About Ultrasound™</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 xl:flex" aria-label="Primary navigation">
          {NAVIGATION.map(item => <Link key={item.href} href={item.href} className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${location === item.href ? "bg-white/10 text-[#8aeae5]" : "text-slate-200 hover:bg-white/10 hover:text-white"}`}>{item.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-2 sm:flex">
          <ExpoAccountMenu />
          <Button onClick={() => setLocation("/register")} className="h-9 bg-[#0c9ba3] px-3 text-sm font-bold hover:bg-[#0a858d]">Register Now</Button>
        </div>
        <button onClick={() => setOpen(!open)} className="rounded-lg p-2 text-white hover:bg-white/10 xl:hidden" aria-label="Toggle menu">{open ? <X /> : <Menu />}</button>
      </div>
      {open && <div className="border-t border-white/10 px-4 py-3 xl:hidden"><nav className="grid gap-1">{NAVIGATION.map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-100 hover:bg-white/10">{item.label}</Link>)}<ExpoMobileAccountLinks onNavigate={() => setOpen(false)} /><Button onClick={() => { setOpen(false); setLocation("/register"); }} className="mt-2 h-10 bg-[#0c9ba3] text-sm">Register Now</Button></nav></div>}
    </header>
  );
}

function InfoPage({ page, event, zones }: { page: string; event: any; zones: Record<string, string> }) {
  const content: Record<string, { eyebrow: string; title: string; body: string; cta: string; type?: string }> = {
    attend: { eyebrow: "Attend UltrasoundExpo™", title: "Your entire ultrasound community, in one place.", body: "Discover registration, education, ScanLabs, career opportunities, networking, and event details created for the annual UltrasoundExpo™ experience.", cta: "View registration options", type: "registrant" },
    exhibit: { eyebrow: "Exhibit at UltrasoundExpo™", title: "Put your technology in front of the ultrasound professionals who use it.", body: "Exhibitor applications are now open. Introduce your technology, services, and expertise to an engaged ultrasound community; booth availability and exhibitor resources will be shared as the event approaches.", cta: "Apply to Exhibit Now", type: "exhibitor" },
    sponsor: { eyebrow: "Sponsor UltrasoundExpo™", title: "Build a visible partnership at the industry's gathering place.", body: "Create meaningful visibility with a sponsorship built around the UltrasoundExpo™ audience. Sponsor opportunities, benefits, and pricing will be announced as the event approaches.", cta: "See sponsorship opportunities", type: "sponsor" },
    program: { eyebrow: "The UltrasoundExpo™ Program", title: "Technology. Education. Innovation. Careers. Community.", body: "The UltrasoundExpo™ program will feature specialty education, ScanLabs, workshops, Innovation Stage programming, career development, and professional connection. CME classifications will be clearly designated when sessions are presented as accredited.", cta: "Register to attend", type: "registrant" },
    expo: { eyebrow: "The UltrasoundExpo™ Exhibit Hall", title: "Explore the future of ultrasound.", body: "The UltrasoundExpo™ Exhibit Hall will bring together manufacturers, AI and software teams, education companies, recruiters, professional organizations, startups, and specialized clinical innovators. An exhibitor directory and floor plan will be published as the inaugural event takes shape.", cta: "Become an exhibitor", type: "exhibitor" },
    connect: { eyebrow: "Connect", title: "Build the network behind your next opportunity.", body: "UltrasoundExpo™ brings together clinical professionals, students, educators, employers, innovators, and industry partners — including Careers LIVE and dedicated networking experiences.", cta: "Register to attend", type: "registrant" },
    about: { eyebrow: "About UltrasoundExpo™", title: "An annual event for everything ultrasound.", body: `${ULTRASOUND_EXPO_NAME}, presented by ${ULTRASOUND_EXPO_ORGANIZER}, is a national gathering for the people and organizations advancing ultrasound. Explore education, innovation, hands-on experiences, career opportunities, connection, and an exhibit hall built for the future of imaging.`, cta: "Explore the experience", type: "registrant" },
  };
  const base = content[page] ?? content.about;
  const current = {
    ...base,
    eyebrow: zones.eyebrow?.trim() || base.eyebrow,
    title: zones.headline?.trim() || base.title,
    body: zones.body?.trim() || base.body,
    cta: zones.cta?.trim() || base.cta,
  };
  return <main className="min-h-screen bg-[#f6fbfc]"><section className="bg-[#062634] px-4 py-20 text-white sm:px-6"><div className="mx-auto max-w-4xl"><p className="mb-4 text-xs font-black uppercase tracking-[0.23em] text-[#6be1dc]">{current.eyebrow}</p><h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.045em] sm:text-6xl">{current.title}</h1><p className="mt-4 text-sm font-bold text-[#a9f7f2]">{formatDateRange(event?.startsAt, event?.endsAt)} · {event?.locationLabel || ULTRASOUND_EXPO_LOCATION_LABEL}</p><p className="mt-7 max-w-2xl text-lg leading-8 text-slate-200">{current.body}</p><Link href={current.type === "exhibitor" ? EXHIBITOR_APPLICATION_HREF : current.type === "sponsor" ? "/partner-application?scope=ultrasound_expo&type=sponsor" : `/register?type=${current.type ?? "registrant"}`} className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#0c9ba3] px-5 py-3 font-bold text-white shadow-xl shadow-cyan-950/30 hover:bg-[#0a858d]">{current.cta}<ArrowRight className="h-4 w-4" /></Link></div></section><section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-3 sm:px-6"><div className="rounded-2xl border border-cyan-100 bg-white p-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#087f8c]">Next event</p><p className="mt-2 text-xl font-black text-slate-900">{event?.name ?? "UltrasoundExpo™ 2028"}</p><p className="mt-2 text-sm text-slate-600">{formatDateRange(event?.startsAt, event?.endsAt)}</p></div><div className="rounded-2xl border border-cyan-100 bg-white p-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#087f8c]">Location</p><p className="mt-2 text-xl font-black text-slate-900">{event?.locationLabel || ULTRASOUND_EXPO_LOCATION_LABEL}</p><p className="mt-2 text-sm text-slate-600">Venue details will be announced here.</p></div><div className="rounded-2xl border border-cyan-100 bg-white p-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#087f8c]">Questions</p><a className="mt-2 block text-xl font-black text-slate-900 hover:text-[#087f8c]" href="mailto:support@allaboutultrasound.com">Support team</a><p className="mt-2 text-sm text-slate-600">support@allaboutultrasound.com</p></div></section>{page === "program" && <ProgramSchedule zones={zones} />}</main>;
}

function scheduleItems(override: string | undefined, fallback: readonly string[]) {
  const customItems = override?.split("\n").map(item => item.trim()).filter(Boolean) ?? [];
  return customItems.length ? customItems : fallback;
}

function ProgramSchedule({ zones }: { zones: Record<string, string> }) {
  const heading = zones.schedule_heading?.trim() || ULTRASOUND_EXPO_SCHEDULE.heading;
  const introduction = zones.schedule_introduction?.trim() || ULTRASOUND_EXPO_SCHEDULE.introduction;
  return <section className="border-t border-cyan-100 bg-[#e8f7f8] px-4 py-16 sm:px-6 sm:py-20">
    <div className="mx-auto max-w-7xl">
      <div className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[.2em] text-[#087f8c]">{ULTRASOUND_EXPO_EVENT_DATES_LABEL} · {ULTRASOUND_EXPO_LOCATION_LABEL}</p>
        <h2 className="mt-3 text-4xl font-black tracking-[-.05em] text-[#062634] sm:text-5xl whitespace-pre-line">{heading}</h2>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 whitespace-pre-line">{introduction}</p>
      </div>
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {ULTRASOUND_EXPO_SCHEDULE.days.map(day => {
          const items = scheduleItems(zones[day.key], day.items);
          return <article key={day.key} className="overflow-hidden rounded-3xl border border-cyan-100 bg-white shadow-[0_12px_36px_rgba(10,68,76,.07)]">
            <div className="bg-[#062b3a] px-6 py-5 text-white">
              <p className="text-xs font-black uppercase tracking-[.2em] text-[#80eee8]">{day.label}</p>
              <h3 className="mt-2 text-xl font-black">{day.title}</h3>
              {"summary" in day && <p className="mt-2 text-sm leading-6 text-slate-200">{day.summary}</p>}
            </div>
            <ol className="divide-y divide-slate-100 px-6 py-2">
              {items.map((item, index) => <li key={`${day.key}-${index}`} className="py-4 text-sm font-semibold leading-6 text-slate-700">{item}</li>)}
            </ol>
          </article>;
        })}
      </div>
    </div>
  </section>;
}

function ExperienceManifesto() {
  return <section className="border-y border-cyan-100 bg-[#062b3a] px-4 py-20 text-white sm:px-6 sm:py-24">
    <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.08fr_.92fr] lg:items-end">
      <div>
        <p className="text-xs font-black uppercase tracking-[.22em] text-[#80eee8]">More than a conference</p>
        <h2 className="mt-4 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-.05em] sm:text-6xl">UltrasoundExpo™ isn&apos;t just another conference or another exhibit hall.</h2>
        <p className="mt-6 max-w-3xl text-xl leading-8 text-slate-200">It&apos;s an immersive ultrasound experience built around doing, discovering, connecting, and participating.</p>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">Explore new technology. Get hands-on. Earn CME. Compete in ultrasound challenges. Meet the people building what&apos;s next. Connect with the ultrasound community.</p>
      </div>
      <aside className="rounded-[2rem] border border-[#74d9d7]/35 bg-white/8 p-8 shadow-2xl shadow-cyan-950/30 sm:p-10">
        <p className="text-xs font-black uppercase tracking-[.2em] text-[#80eee8]">PLEASE DO NOT SIT HERE ALL DAY.</p>
        <h3 className="mt-4 text-3xl font-black leading-tight tracking-[-.04em]">UltrasoundExpo™ was designed to get you out of the chair.</h3>
        <p className="mt-6 text-lg font-black uppercase tracking-[.18em] text-white">Scan. Explore. Compete. Learn. Network. Discover.</p>
        <p className="mt-7 leading-7 text-slate-200">Of course there will be world-class education. But there will also be ScanLabs, new technology, live demonstrations, SonoGames, Innovation Showcase, friendly competitions, career opportunities, and an entire ultrasound community waiting outside the classroom.</p>
      </aside>
    </div>
    <div className="mx-auto mt-12 max-w-7xl border-t border-white/15 pt-9 text-center">
      <p className="text-2xl font-black tracking-[-.04em] text-white sm:text-4xl">Not Another Conference. <span className="text-[#80eee8]">An Ultrasound Experience.</span></p>
      <p className="mt-4 text-xl font-black tracking-[.02em] text-[#4ad9e0] drop-shadow-[0_0_22px_rgba(74,217,224,.42)] sm:text-2xl">You Don&apos;t Just Attend It. You Experience It.</p>
    </div>
  </section>;
}

export default function UltrasoundExpoSite() {
  const [location] = useLocation();
  const { data, isLoading } = trpc.ultrasoundExpo.publicLaunch.useQuery();
  const page = location === "/" ? "home" : location.split("/")[1]?.split("?")[0] ?? "home";
  const pageZones = trpc.sitePages.admin.getPublicPageZones.useQuery({
    domain: ULTRASOUND_EXPO_SITE_DOMAIN,
    slug: page,
  });
  const pageRecord = trpc.sitePages.public.getBySlug.useQuery({
    domain: ULTRASOUND_EXPO_SITE_DOMAIN,
    slug: page,
  });
  const zones = pageZones.data ?? {};
  const defaultSeo = getUltrasoundExpoPageSeo(page);
  const seo = {
    title: pageRecord.data?.seoTitle || defaultSeo.title,
    description: pageRecord.data?.seoDescription || defaultSeo.description,
    image: pageRecord.data?.seoImage || defaultSeo.image,
  };
  useSeoHead({
    title: seo.title,
    description: seo.description,
    image: seo.image,
    canonical: `${ULTRASOUND_EXPO_ORIGIN}${page === "home" ? "/" : `/${page}`}`,
    siteName: ULTRASOUND_EXPO_NAME,
    appendSiteName: false,
    keywords: "ultrasound conference, ultrasound expo, sonography education, ultrasound innovation, ultrasound exhibitors",
  });
  const event = data?.event;
  if (page !== "home") return <><ExpoHeader /><InfoPage page={page} event={event} zones={zones} /></>;
  return <div className="min-h-screen bg-[#f6fbfc] text-slate-900"><ExpoHeader />
    <main>
      <section className="relative isolate overflow-hidden bg-[#052331] text-white"><img src={event?.heroImageUrl || ULTRASOUND_EXPO_HERO_IMAGE} alt="Professionals exploring ultrasound technology at UltrasoundExpo™" className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-55" /><div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(2,21,31,.96)_0%,rgba(3,30,42,.87)_42%,rgba(4,54,62,.28)_100%)]" />
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:py-40"><div className="max-w-3xl"><p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#72e1de]/45 bg-[#07626b]/35 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#a9f7f2]"><Sparkles className="h-3.5 w-3.5" /> {zones.hero_eyebrow?.trim() || "Annual national ultrasound event"}</p><h1 className="text-5xl font-black leading-[.96] tracking-[-0.06em] sm:text-7xl lg:text-8xl whitespace-pre-line">{zones.hero_headline?.trim() || <>Everything Ultrasound.<br/><span className="text-[#72e1de]">One Place.</span></>}</h1><p className="mt-5 text-sm font-black uppercase tracking-[.14em] text-[#a9f7f2]">{formatDateRange(event?.startsAt, event?.endsAt)} · {event?.locationLabel || ULTRASOUND_EXPO_LOCATION_LABEL}</p><p className="mt-7 max-w-2xl text-lg leading-8 text-slate-100 sm:text-xl">{zones.hero_subtitle?.trim() || "Experience the technology, education, hands-on training, career opportunities, and innovation shaping the future of ultrasound."}</p><div className="mt-9 flex flex-wrap gap-3"><Button onClick={() => window.location.assign("/register?type=registrant")} className="h-12 bg-[#0c9ba3] px-6 text-base font-bold shadow-xl shadow-cyan-950/40 hover:bg-[#0a858d]">{zones.hero_primary_cta?.trim() || "Register Now"} <ArrowRight className="ml-2 h-4 w-4" /></Button><Button onClick={() => window.location.assign(EXHIBITOR_APPLICATION_HREF)} variant="outline" className="h-12 border-white/55 bg-white/10 px-6 text-base font-bold text-white hover:bg-white hover:text-[#062634]">{zones.hero_secondary_cta?.trim() || "Apply to Exhibit"}</Button></div></div></div>
      </section>
      <section className="border-b border-cyan-100 bg-white">
        <div className="mx-auto grid max-w-7xl divide-y divide-cyan-100 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <span className="block text-[10px] font-black uppercase tracking-[.18em] text-[#087f8c]">Event date</span>
            <span className="mt-1 block font-bold text-slate-900">{isLoading ? "Loading event…" : formatDateRange(event?.startsAt, event?.endsAt)}</span>
          </div>
          <div className="p-5">
            <span className="block text-[10px] font-black uppercase tracking-[.18em] text-[#087f8c]">City / venue</span>
            <span className="mt-1 block font-bold text-slate-900">{event?.locationLabel || ULTRASOUND_EXPO_LOCATION_LABEL}</span>
          </div>
          <div className="p-5">
            <span className="block text-[10px] font-black uppercase tracking-[.18em] text-[#087f8c]">Attendee registration</span>
            <span className="mt-1 block font-bold text-slate-900">Registration opens soon</span>
          </div>
          <div className="p-5">
            <span className="block text-[10px] font-black uppercase tracking-[.18em] text-[#087f8c]">Exhibitor applications</span>
            <span className="mt-1 block font-bold text-slate-900">Applications open now</span>
            <Link href={EXHIBITOR_APPLICATION_HREF} className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[#087f8c] hover:text-[#065f68]">Apply to exhibit now <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
      </section>
      <ExperienceManifesto />
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><p className="text-center text-xs font-black uppercase tracking-[.22em] text-[#087f8c]">A national meeting place</p><h2 className="mx-auto mt-3 max-w-3xl text-center text-3xl font-black tracking-[-.04em] text-[#062634] sm:text-5xl whitespace-pre-line">{zones.community_headline?.trim() || "One event. The entire ultrasound community."}</h2><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{EXPERIENCES.map(([Icon, title, text]) => <div key={title} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_36px_rgba(10,68,76,.06)] transition-transform hover:-translate-y-1"><Icon className="h-7 w-7 text-[#087f8c]" /><h3 className="mt-5 text-xl font-black text-[#062634]">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p><ChevronDown className="mt-5 h-4 w-4 -rotate-90 text-[#087f8c]" /></div>)}</div></section>
      <section className="bg-[#e8f7f8] px-4 py-20 sm:px-6"><div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_.95fr] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#087f8c]">Experience the UltrasoundExpo™ Exhibit Hall</p><h2 className="mt-3 text-4xl font-black tracking-[-.05em] text-[#062634] sm:text-5xl whitespace-pre-line">{zones.exhibit_headline?.trim() || "Meet the teams building what comes next."}</h2><p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">Explore ultrasound manufacturers, technologies, AI solutions, workflow tools, education platforms, career opportunities, accessories, medical devices, software, and emerging ultrasound innovations.</p><Link href={EXHIBITOR_APPLICATION_HREF} className="mt-7 inline-flex items-center gap-2 font-bold text-[#087f8c] hover:text-[#065f68]">Apply to exhibit <ArrowRight className="h-4 w-4" /></Link></div><div className="rounded-[2rem] bg-[#062b3a] p-8 text-white shadow-2xl shadow-cyan-900/20"><p className="text-xs font-black uppercase tracking-[.18em] text-[#80eee8]">Designed to grow</p><div className="mt-6 space-y-5">{[[CalendarDays, "Annual event platform", "Each annual UltrasoundExpo™ experience brings new programs and opportunities."],[ShieldCheck, "Your event experience, in one place", "Use your account to access UltrasoundExpo™ registration details, tickets, and event updates."],[MapPin, "Live details when ready", "Venue, travel, agenda, pricing, and announcements will be shared as plans are confirmed."]].map(([Icon, title, text]) => <div key={String(title)} className="flex gap-4"><div className="mt-0.5 rounded-lg bg-white/10 p-2"><Icon className="h-5 w-5 text-[#80eee8]" /></div><div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-300">{text}</p></div></div>)}</div></div></div></section>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><div className="grid gap-8 md:grid-cols-2"><div className="rounded-3xl bg-[#062b3a] p-8 text-white"><p className="text-xs font-black uppercase tracking-[.2em] text-[#80eee8]">Get hands-on</p><h2 className="mt-3 text-3xl font-black tracking-[-.04em]">ScanLabs, workshops, and skills that translate.</h2><p className="mt-4 leading-7 text-slate-300">As programming is published, administrators can manage event-specific hands-on experiences, capacity, waitlists, and CME designations through UltrasoundExpo™.</p><Link href="/program" className="mt-6 inline-flex items-center gap-2 font-bold text-[#80eee8]">Explore the program <ArrowRight className="h-4 w-4" /></Link></div><div className="rounded-3xl bg-[#0c9ba3] p-8 text-white"><p className="text-xs font-black uppercase tracking-[.2em] text-white/75">Founding industry partners</p><h2 className="mt-3 text-3xl font-black tracking-[-.04em] whitespace-pre-line">{zones.partner_headline?.trim() || "Create a presence at the ultrasound industry's new annual meeting."}</h2><p className="mt-4 leading-7 text-white/85">UltrasoundExpo™ sponsorships and exhibit opportunities are designed to help organizations build meaningful connections.</p><Link href="/sponsor" className="mt-6 inline-flex items-center gap-2 font-bold text-white">Partner with UltrasoundExpo™ <ArrowRight className="h-4 w-4" /></Link></div></div></section>
      <section className="px-4 pb-20 sm:px-6"><div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#061f2d] px-7 py-12 text-white shadow-2xl shadow-cyan-950/20 sm:px-12 sm:py-16"><img src="/manus-storage/echoexpo-banner_ddd8774a.png" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-30" /><div className="absolute inset-0 bg-[linear-gradient(95deg,rgba(3,25,38,.98),rgba(3,44,57,.91),rgba(8,120,126,.58))]" /><div className="relative max-w-3xl"><p className="text-xs font-black uppercase tracking-[.22em] text-[#80eee8]">Inside UltrasoundExpo™</p><h2 className="mt-3 text-4xl font-black tracking-[-.05em] sm:text-5xl">EchoExpo™</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-100">A dedicated cardiac ultrasound and echocardiography experience featuring focused education, Echo Skills, Echo Games, hands-on CME workshops, and a cardiac-centered exhibit-hall destination.</p><a href="https://www.echocardiographyexpo.com/" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#0c9ba3] px-5 py-3 font-bold text-white shadow-lg shadow-cyan-950/30 transition hover:bg-[#0a858d]">Explore EchoExpo™ <ArrowRight className="h-4 w-4" /></a></div></div></section>
    </main><footer className="bg-[#041a25] px-4 py-12 text-slate-300 sm:px-6"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 sm:flex-row"><div><p className="text-xl font-black text-white">Ultrasound<span className="text-[#76e5df]">Expo™</span></p><p className="mt-2 text-sm">Everything Ultrasound. One Place.</p><p className="mt-1 text-xs text-slate-400">Organized by All About Ultrasound™</p></div><div className="flex gap-6 text-sm"><Link href="/about" className="hover:text-white">About</Link><Link href="/attend" className="hover:text-white">Attend</Link><Link href={EXHIBITOR_APPLICATION_HREF} className="hover:text-white">Exhibit</Link><a href="mailto:support@allaboutultrasound.com" className="hover:text-white">Contact</a></div></div></footer>
  </div>;
}
