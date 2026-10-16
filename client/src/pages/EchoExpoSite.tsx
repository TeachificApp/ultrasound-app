import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  HeartPulse,
  MapPin,
  Menu,
  MonitorPlay,
  Network,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  Trophy,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSeoHead } from "@/hooks/useSeoHead";
import { ExpoAccountMenu, ExpoMobileAccountLinks } from "@/components/ExpoAccountMenu";

const ULTRASOUND_EXPO_ORIGIN = "https://ultrasoundexpo.com";
const ECHO_EXPO_ORIGIN = "https://echoexpo.iheartecho.com";
const ECHO_EXPO_HERO_IMAGE = "/manus-storage/echoexpo-supplied-tradeshow-hero_e230df63.png";
const ECHO_EXPO_EXHIBIT_PATH = "/partner-application?scope=ultrasound_expo&type=exhibitor&event=echoexpo";
const ECHO_EXPO_SPONSOR_PATH = "/partner-application?scope=ultrasound_expo&type=sponsor&event=echoexpo";
const ECHO_EXPO_REGISTER_PATH = "/register?event=echoexpo";

const NAVIGATION = [
  { label: "Attend", href: "/attend" },
  { label: "Exhibit", href: "/exhibit" },
  { label: "Sponsor", href: "/sponsor" },
  { label: "Program", href: "/program" },
  { label: "Exhibit Hall", href: "/expo" },
  { label: "Connect", href: "/connect" },
  { label: "About", href: "/about" },
] as const;

const PAGE_COPY: Record<string, { eyebrow: string; title: string; body: string; cta: string; href: string }> = {
  attend: {
    eyebrow: "Attend EchoExpo™",
    title: "The cardiac ultrasound community has its own destination.",
    body: "Explore EchoExpo™ education, Echo Skills, Echo Games, hands-on experiences, networking, and cardiac ultrasound innovation within the shared annual UltrasoundExpo™ event.",
    cta: "Registration information",
    href: ECHO_EXPO_REGISTER_PATH,
  },
  exhibit: {
    eyebrow: "Exhibit at EchoExpo™",
    title: "Meet the cardiac imaging audience in a dedicated exhibit-hall destination.",
    body: "EchoExpo™ exhibitors connect with sonographers, physicians, educators, and innovators focused on echocardiography, structural heart imaging, cardiac POCUS, and cardiovascular technology.",
    cta: "Apply to exhibit",
    href: ECHO_EXPO_EXHIBIT_PATH,
  },
  sponsor: {
    eyebrow: "Sponsor EchoExpo™",
    title: "Build meaningful visibility with the echo community.",
    body: "Place your brand at the center of cardiac ultrasound education, skills, connection, and innovation. EchoExpo™ sponsorships create high-value visibility with the professionals and organizations moving echocardiography forward.",
    cta: "Apply to sponsor",
    href: ECHO_EXPO_SPONSOR_PATH,
  },
  program: {
    eyebrow: "The EchoExpo™ program",
    title: "Cardiac education, skills, community, and innovation.",
    body: "The developing EchoExpo™ program brings together echocardiography education, hands-on learning, Echo Skills, Echo Games, clinical discussion, and cardiac-focused industry innovation. CME designations will be clearly noted as programming is confirmed.",
    cta: "View registration information",
    href: ECHO_EXPO_REGISTER_PATH,
  },
  expo: {
    eyebrow: "The EchoExpo™ Exhibit Hall",
    title: "A cardiac imaging destination within the UltrasoundExpo™ hall.",
    body: "Bring your technology, ideas, and expertise to the cardiac imaging audience. EchoExpo™ unites the clinicians, educators, innovators, and decision-makers who are shaping the next era of echocardiography and cardiovascular care.",
    cta: "Apply to exhibit",
    href: ECHO_EXPO_EXHIBIT_PATH,
  },
  connect: {
    eyebrow: "Connect at EchoExpo™",
    title: "Find the people moving echo forward.",
    body: "Connect with cardiac sonographers, physicians, educators, students, innovators, employers, and organizations dedicated to echocardiography. The event community and updates are available through the shared UltrasoundExpo™ experience after registration.",
    cta: "Registration information",
    href: ECHO_EXPO_REGISTER_PATH,
  },
  about: {
    eyebrow: "About EchoExpo™",
    title: "The dedicated echocardiography experience within UltrasoundExpo™.",
    body: "EchoExpo™ by iHeartEcho™ brings a focused cardiac ultrasound destination to the annual UltrasoundExpo™ event. It combines echo education, practical skills, community experiences, industry connection, and a dedicated exhibit hall pathway in one shared event environment.",
    cta: "Explore UltrasoundExpo™",
    href: ULTRASOUND_EXPO_ORIGIN,
  },
};

const EXPERIENCES: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: Stethoscope, title: "Cardiac education", text: "Focused echocardiography education for clinical questions, measurements, modalities, and decisions that matter." },
  { icon: HeartPulse, title: "Echo Skills", text: "Practical skill-building and hands-on learning for cardiac imaging professionals." },
  { icon: Trophy, title: "Echo Games", text: "Community-forward challenges and experiences built to celebrate echo knowledge and connection." },
  { icon: ScanLine, title: "Hands-on CME", text: "CME-designated workshops and ScanLab-style experiences announced as the program develops." },
  { icon: MonitorPlay, title: "Innovation", text: "Discover technology, workflow, AI, and product ideas shaping cardiac imaging." },
  { icon: Network, title: "Community", text: "Build the professional relationships behind education, careers, and better cardiovascular care." },
];

function EchoExpoHeader() {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const currentPath = location.split("?")[0];
  return <header className="sticky top-0 z-50 border-b border-white/10 bg-[#071f2d]/95 text-white backdrop-blur">
    <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
      <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="EchoExpo home">
        <img src="/manus-storage/echoexpo-logo_535dff69.png" alt="EchoExpo™ emblem" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 leading-none"><p className="whitespace-nowrap text-xl font-black tracking-[-.06em] text-white sm:text-2xl">Echo<span className="text-[#72e1de]">Expo</span><sup className="ml-0.5 align-top text-[9px] tracking-normal">™</sup></p><p className="mt-1 text-[8px] font-black uppercase tracking-[.22em] text-slate-200">by iHeartEcho™</p></div>
      </Link>
      <nav className="hidden items-center gap-0.5 xl:flex" aria-label="EchoExpo primary navigation">
        {NAVIGATION.map(item => <Link key={item.href} href={item.href} className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${currentPath === item.href ? "bg-white/10 text-[#8bece7]" : "text-slate-200 hover:bg-white/10 hover:text-white"}`}>{item.label}</Link>)}
      </nav>
      <div className="hidden items-center gap-2 sm:flex">
        <a href={ULTRASOUND_EXPO_ORIGIN} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#9eece8] hover:bg-white/10">UltrasoundExpo™</a>
        <ExpoAccountMenu />
        <Button onClick={() => setLocation(ECHO_EXPO_REGISTER_PATH)} className="h-9 bg-[#0b9fa5] px-3 text-sm font-bold hover:bg-[#098a90]">Register Now</Button>
      </div>
      <button onClick={() => setOpen(current => !current)} className="rounded-lg p-2 text-white hover:bg-white/10 xl:hidden" aria-label="Toggle EchoExpo navigation">{open ? <X /> : <Menu />}</button>
    </div>
    {open && <div className="border-t border-white/10 px-4 py-3 xl:hidden"><nav className="grid gap-1">{NAVIGATION.map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-100 hover:bg-white/10">{item.label}</Link>)}<a href={ULTRASOUND_EXPO_ORIGIN} className="rounded-lg px-3 py-3 text-sm font-semibold text-[#9eece8] hover:bg-white/10">UltrasoundExpo™</a><ExpoMobileAccountLinks onNavigate={() => setOpen(false)} /><Button onClick={() => { setOpen(false); setLocation(ECHO_EXPO_REGISTER_PATH); }} className="mt-2 h-10 bg-[#0b9fa5] text-sm">Register Now</Button></nav></div>}
  </header>;
}

function EventFacts() {
  return <section className="border-b border-cyan-100 bg-white"><div className="mx-auto grid max-w-7xl divide-y divide-cyan-100 sm:grid-cols-4 sm:divide-x sm:divide-y-0"><Fact label="Event dates" value="January 14–16, 2028" icon={CalendarDays} /><Fact label="City / venue" value="Orlando, Florida · Venue TBD" icon={MapPin} /><Fact label="Attendee registration" value="Registration opens soon" icon={UsersRound} /><div className="p-5"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#087f8c]">Exhibitor applications</p><p className="mt-1 font-bold text-slate-900">Applications open now</p><Link href={ECHO_EXPO_EXHIBIT_PATH} className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[#087f8c] hover:text-[#065f68]">Apply to exhibit <ArrowRight className="h-3.5 w-3.5" /></Link></div></div></section>;
}

function EchoInfoPage({ page }: { page: string }) {
  const copy = PAGE_COPY[page] ?? PAGE_COPY.about;
  return <main className="min-h-screen bg-[#f4f9fb]"><section className="bg-[#072938] px-4 py-20 text-white sm:px-6"><div className="mx-auto max-w-4xl"><p className="text-xs font-black uppercase tracking-[.2em] text-[#7fe8e3]">{copy.eyebrow}</p><h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.03] tracking-[-.05em] sm:text-6xl">{copy.title}</h1><p className="mt-5 text-sm font-black uppercase tracking-[.14em] text-[#a9f7f2]">January 14–16, 2028 · Orlando, Florida · Venue TBD</p><p className="mt-7 max-w-3xl text-lg leading-8 text-slate-200">{copy.body}</p><Link href={copy.href} className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#0b9fa5] px-5 py-3 font-bold text-white shadow-xl shadow-cyan-950/30 hover:bg-[#098a90]">{copy.cta}<ArrowRight className="h-4 w-4" /></Link></div></section><EventFacts />
    {page === "program" && <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[.2em] text-[#087f8c]">Program preview</p><h2 className="mt-3 text-4xl font-black tracking-[-.05em] text-[#062b3a] sm:text-5xl">A focused cardiac pathway across the annual event.</h2><p className="mt-5 text-lg leading-8 text-slate-600">Step into a program built around the ideas, skills, and clinical conversations powering the future of echocardiography. Sessions, hands-on learning, and community experiences are being curated for an unforgettable cardiac destination.</p></div><div className="mt-10 grid gap-5 md:grid-cols-3">{[["Education", "Echocardiography education, case-based learning, and clinical discussion."], ["Skills", "Echo Skills, hands-on workshops, and practical cardiac imaging development."], ["Community", "Echo Games, connection, careers, and industry innovation."]].map(([title, text]) => <article key={title} className="rounded-3xl border border-cyan-100 bg-white p-7 shadow-sm"><h3 className="text-xl font-black text-[#062b3a]">{title}</h3><p className="mt-3 leading-7 text-slate-600">{text}</p></article>)}</div></section>}
    {page === "expo" && <section className="bg-[#e8f7f8] px-4 py-20 sm:px-6"><div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_.95fr]"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#087f8c]">Exhibit at EchoExpo™</p><h2 className="mt-3 text-4xl font-black tracking-[-.05em] text-[#062b3a] sm:text-5xl">Make cardiac imaging your most valuable conversation.</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">Position your organization where echocardiography professionals come to discover what is next. EchoExpo™ brings together technology, education, and clinical insight in a dynamic, cardiac-focused exhibit-hall destination.</p><Link href={ECHO_EXPO_EXHIBIT_PATH} className="mt-7 inline-flex items-center gap-2 font-bold text-[#087f8c] hover:text-[#065f68]">Apply to exhibit at EchoExpo™ <ArrowRight className="h-4 w-4" /></Link></div><div className="rounded-3xl bg-[#062b3a] p-8 text-white"><ShieldCheck className="h-7 w-7 text-[#81eee8]" /><h3 className="mt-5 text-2xl font-black">A dedicated destination for cardiac innovation.</h3><p className="mt-4 leading-7 text-slate-300">Stand out in an environment designed for purposeful conversations, hands-on discovery, and meaningful connections with the echo professionals who influence care every day.</p></div></div></section>}
  </main>;
}

export default function EchoExpoSite() {
  const [location] = useLocation();
  const path = location.split("?")[0];
  const page = path === "/" ? "home" : path.replace(/^\//, "");
  const pageTitle = page === "home" ? "EchoExpo™ | The Echocardiography Experience at UltrasoundExpo™" : `${PAGE_COPY[page]?.eyebrow ?? "EchoExpo™"} | EchoExpo™`;
  const pageDescription = page === "home"
    ? "EchoExpo™ is the dedicated cardiac ultrasound and echocardiography experience within UltrasoundExpo™, featuring cardiac education, Echo Games, Echo Skills, hands-on CME workshops, and a focused exhibit hall destination."
    : PAGE_COPY[page]?.body ?? PAGE_COPY.about.body;
  useSeoHead({
    title: pageTitle,
    description: pageDescription,
    image: ECHO_EXPO_HERO_IMAGE,
    canonical: `${ECHO_EXPO_ORIGIN}${page === "home" ? "/" : path}`,
    siteName: "EchoExpo™",
    appendSiteName: false,
    keywords: "echo conference, echocardiography event, cardiac ultrasound, Echo Games, Echo Skills, echocardiography exhibitors",
  });

  if (page !== "home") return <div className="min-h-screen bg-[#f4f9fb] text-[#092638]"><EchoExpoHeader /><EchoInfoPage page={page} /><EchoFooter /></div>;

  return <div className="min-h-screen bg-[#f4f9fb] text-[#092638]"><EchoExpoHeader />
    <main>
      <section className="relative isolate overflow-hidden bg-[#052331] text-white"><img src={ECHO_EXPO_HERO_IMAGE} alt="Live cardiac ultrasound scanning in the EchoExpo™ exhibit hall" className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-55" /><div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(2,21,31,.96)_0%,rgba(3,30,42,.87)_42%,rgba(4,54,62,.28)_100%)]" /><div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:py-40"><div className="max-w-3xl"><p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#72e1de]/45 bg-[#07626b]/35 px-4 py-2 text-xs font-black uppercase tracking-[.18em] text-[#a9f7f2]"><HeartPulse className="h-3.5 w-3.5" /> Annual national echocardiography event</p><h1 className="text-5xl font-black leading-[.96] tracking-[-.06em] sm:text-7xl lg:text-8xl">Everything Echo.<br /><span className="text-[#72e1de]">One Place.</span></h1><p className="mt-5 text-sm font-black uppercase tracking-[.14em] text-[#a9f7f2]">January 14–16, 2028 · Orlando, Florida · Venue TBD</p><p className="mt-7 max-w-2xl text-lg leading-8 text-slate-100 sm:text-xl">Experience the cardiac technology, education, hands-on training, career opportunities, and innovation shaping the future of echocardiography.</p><div className="mt-9 flex flex-wrap gap-3"><Button asChild className="h-12 bg-[#0c9ba3] px-6 text-base font-bold shadow-xl shadow-cyan-950/40 hover:bg-[#0a858d]"><Link href={ECHO_EXPO_REGISTER_PATH}>Register Now <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild variant="outline" className="h-12 border-white/55 bg-white/10 px-6 text-base font-bold text-white hover:bg-white hover:text-[#062634]"><Link href={ECHO_EXPO_EXHIBIT_PATH}>Apply to Exhibit</Link></Button></div></div></div></section>
      <EventFacts />
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><p className="text-center text-xs font-black uppercase tracking-[.22em] text-[#087f8c]">Dedicated cardiac pathways</p><h2 className="mx-auto mt-3 max-w-4xl text-center text-4xl font-black tracking-[-.05em] text-[#062b3a] sm:text-6xl">A destination for the echo community.</h2><p className="mx-auto mt-6 max-w-3xl text-center text-lg leading-8 text-slate-600">EchoExpo™ places cardiac ultrasound at the center of the annual UltrasoundExpo™ experience, with its own educational focus, community energy, exhibitor destination, and attendee pathway.</p><div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{EXPERIENCES.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-cyan-100 bg-white p-6 shadow-[0_12px_36px_rgba(10,68,76,.06)]"><Icon className="h-7 w-7 text-[#087f8c]" /><h3 className="mt-5 text-xl font-black text-[#062b3a]">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p><ChevronDown className="mt-5 h-4 w-4 -rotate-90 text-[#087f8c]" /></article>)}</div></section>
      <section className="bg-[#e8f7f8] px-4 py-20 sm:px-6"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.08fr_.92fr] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#087f8c]">Exhibit with purpose</p><h2 className="mt-3 text-4xl font-black tracking-[-.05em] text-[#062b3a] sm:text-5xl">Meet the cardiac ultrasound audience in its own exhibit-hall destination.</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">Put your technology, expertise, and story in front of a focused community of echocardiography professionals, clinical leaders, and innovators who come ready to learn, connect, and discover.</p><Button asChild className="mt-8 h-12 bg-[#0b9fa5] px-6 font-bold hover:bg-[#098a90]"><Link href={ECHO_EXPO_EXHIBIT_PATH}>Apply to exhibit at EchoExpo™ <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div><aside className="rounded-[2rem] bg-[#062b3a] p-8 text-white shadow-xl shadow-cyan-900/20"><p className="text-xs font-black uppercase tracking-[.18em] text-[#81eee8]">Built for connection</p><h3 className="mt-3 text-3xl font-black">One event. A powerful cardiac audience.</h3><p className="mt-4 leading-7 text-slate-300">Create memorable brand moments at the meeting place for cardiac imaging. From breakthrough technology to practical education, EchoExpo™ is where meaningful conversations turn into lasting relationships.</p><Link href={ECHO_EXPO_EXHIBIT_PATH} className="mt-7 inline-flex items-center gap-2 font-bold text-[#9cf2ed] hover:text-white">Explore exhibit opportunities <ArrowRight className="h-4 w-4" /></Link></aside></div></section>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><div className="grid gap-8 md:grid-cols-2"><div className="rounded-3xl bg-[#062b3a] p-8 text-white"><p className="text-xs font-black uppercase tracking-[.2em] text-[#80eee8]">Program and skills</p><h2 className="mt-3 text-3xl font-black tracking-[-.04em]">Cardiac education designed for what comes next.</h2><p className="mt-4 leading-7 text-slate-300">Explore the developing cardiac program, skills pathway, workshops, Echo Games, and community experiences.</p><Link href="/program" className="mt-6 inline-flex items-center gap-2 font-bold text-[#80eee8]">Explore the EchoExpo™ program <ArrowRight className="h-4 w-4" /></Link></div><div className="rounded-3xl bg-[#0b9fa5] p-8 text-white"><p className="text-xs font-black uppercase tracking-[.2em] text-white/75">Part of the annual event</p><h2 className="mt-3 text-3xl font-black tracking-[-.04em]">EchoExpo™ connects directly to UltrasoundExpo™.</h2><p className="mt-4 leading-7 text-white/85">Be part of a national gathering where the full ultrasound community comes together to share knowledge, spark ideas, and shape what comes next in imaging.</p><a href={ULTRASOUND_EXPO_ORIGIN} className="mt-6 inline-flex items-center gap-2 font-bold text-white">Visit UltrasoundExpo™ <ArrowRight className="h-4 w-4" /></a></div></div></section>
    </main><EchoFooter />
  </div>;
}

function Fact({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) { return <div className="flex items-center gap-3 p-5"><div className="rounded-lg bg-[#e8f7f8] p-2"><Icon className="h-5 w-5 text-[#087f8c]" /></div><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#087f8c]">{label}</p><p className="mt-1 font-bold text-slate-900">{value}</p></div></div>; }
function EchoFooter() { return <footer className="bg-[#041923] px-4 py-10 text-slate-300 sm:px-6"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 sm:flex-row"><div><p className="font-black text-white">EchoExpo™ <span className="text-[#8bece7]">by iHeartEcho™</span></p><p className="mt-1 text-sm">A dedicated experience within UltrasoundExpo™.</p></div><div className="flex flex-wrap gap-5 text-sm font-bold"><a href={ULTRASOUND_EXPO_ORIGIN} className="text-[#9cefea] hover:text-white">UltrasoundExpo™</a><a href="mailto:support@allaboutultrasound.com" className="text-[#9cefea] hover:text-white">support@allaboutultrasound.com</a></div></div></footer>; }
