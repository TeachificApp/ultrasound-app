import { ArrowRight, CalendarDays, HeartPulse, MapPin, Stethoscope, Trophy, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSeoHead } from "@/hooks/useSeoHead";

const ULTRASOUND_EXPO = "https://ultrasoundexpo.com";
const ECHO_EXPO_EXHIBIT_PATH = `${ULTRASOUND_EXPO}/partner-application?scope=ultrasound_expo&type=exhibitor&event=echoexpo`;
const ECHO_EXPO_ATTEND_PATH = `${ULTRASOUND_EXPO}/register?event=echoexpo`;

export default function EchoExpoSite() {
  useSeoHead({
    title: "EchoExpo™ | The Echocardiography Experience at UltrasoundExpo™",
    description: "EchoExpo™ is the dedicated cardiac ultrasound and echocardiography experience within UltrasoundExpo™, featuring cardiac education, Echo Games, Echo Skills, hands-on CME workshops, and a focused exhibit hall destination.",
    image: "/manus-storage/echoexpo-banner_ddd8774a.png",
    canonical: "https://echoexpo.iheartecho.com/",
    siteName: "EchoExpo™",
    appendSiteName: false,
    keywords: "echo conference, echocardiography event, cardiac ultrasound, Echo Games, Echo Skills, echocardiography exhibitors",
  });

  return <div className="min-h-screen bg-[#f4f9fb] text-[#092638]">
    <header className="border-b border-white/15 bg-[#071f2d] text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="/" className="flex min-w-0 items-center gap-3" aria-label="EchoExpo home">
          <img src="/manus-storage/echoexpo-logo_535dff69.png" alt="EchoExpo™ by iHeartEcho™" className="h-11 max-w-[190px] object-contain object-left" />
        </a>
        <nav className="hidden items-center gap-5 text-sm font-bold text-slate-200 md:flex" aria-label="EchoExpo navigation">
          <a href="#experience" className="hover:text-[#77e6e0]">Experience</a>
          <a href="#exhibit" className="hover:text-[#77e6e0]">Exhibit</a>
          <a href="#program" className="hover:text-[#77e6e0]">Program</a>
          <a href={ULTRASOUND_EXPO} className="rounded-lg border border-white/20 px-3 py-2 text-[#9eece8] hover:bg-white/10">UltrasoundExpo™</a>
        </nav>
      </div>
    </header>

    <main>
      <section className="relative isolate overflow-hidden bg-[#072938] text-white">
        <img src="/manus-storage/echoexpo-banner_ddd8774a.png" alt="EchoExpo™ cardiac ultrasound experience" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(95deg,rgba(4,24,37,.97),rgba(4,43,57,.86),rgba(10,105,112,.52))]" />
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:py-40">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#75e6e0]/50 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[.18em] text-[#a6f7f1]"><HeartPulse className="h-4 w-4" /> A focused cardiac ultrasound experience</p>
            <h1 className="mt-6 text-5xl font-black leading-[.94] tracking-[-.06em] sm:text-7xl">EchoExpo™<br /><span className="text-[#7fe8e3]">Where echocardiography comes alive.</span></h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-100 sm:text-xl">The dedicated cardiac ultrasound and echocardiography experience within UltrasoundExpo™ — designed for sonographers, physicians, educators, innovators, and the organizations shaping cardiac imaging.</p>
            <div className="mt-9 flex flex-wrap gap-3"><Button asChild className="h-12 bg-[#0b9fa5] px-6 text-base font-bold hover:bg-[#098a90]"><a href={ECHO_EXPO_ATTEND_PATH}>Explore attendee pathways <ArrowRight className="ml-2 h-4 w-4" /></a></Button><Button asChild variant="outline" className="h-12 border-white/60 bg-white/10 px-6 text-base font-bold text-white hover:bg-white hover:text-[#062634]"><a href={ECHO_EXPO_EXHIBIT_PATH}>Apply to exhibit <ArrowRight className="ml-2 h-4 w-4" /></a></Button></div>
          </div>
        </div>
      </section>

      <section className="border-b border-cyan-100 bg-white"><div className="mx-auto grid max-w-7xl divide-y divide-cyan-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0"><Fact label="Event dates" value="January 14–16, 2028" icon={CalendarDays} /><Fact label="Location" value="Orlando, Florida · Venue TBD" icon={MapPin} /><Fact label="Hosted within" value="UltrasoundExpo™" icon={UsersRound} /></div></section>

      <section id="experience" className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><p className="text-center text-xs font-black uppercase tracking-[.22em] text-[#087f8c]">Dedicated cardiac pathways</p><h2 className="mx-auto mt-3 max-w-4xl text-center text-4xl font-black tracking-[-.05em] text-[#062b3a] sm:text-6xl">A destination for the echo community.</h2><p className="mx-auto mt-6 max-w-3xl text-center text-lg leading-8 text-slate-600">EchoExpo™ places cardiac ultrasound at the center of the annual UltrasoundExpo™ experience, with its own educational focus, community energy, exhibitor destination, and opportunity pathways.</p><div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4"><Experience icon={Stethoscope} title="Cardiac education" text="Focused echocardiography education for the clinical questions, measurements, and modalities that matter." /><Experience icon={HeartPulse} title="Echo Skills" text="Practical skill-building and hands-on learning designed for cardiac imaging professionals." /><Experience icon={Trophy} title="Echo Games" text="Community-forward challenges and experiences built to celebrate echo knowledge and connection." /><Experience icon={HeartPulse} title="Hands-on CME workshops" text="CME-designated workshops and ScanLab-style experiences will be announced as the program develops." /></div></section>

      <section id="exhibit" className="bg-[#e8f7f8] px-4 py-20 sm:px-6"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.08fr_.92fr] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#087f8c]">Exhibit with purpose</p><h2 className="mt-3 text-4xl font-black tracking-[-.05em] text-[#062b3a] sm:text-5xl">Meet the cardiac ultrasound audience in its own exhibit-hall destination.</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">EchoExpo™ exhibitors join an audience centered on echocardiography, cardiac ultrasound technology, education, innovation, and clinical practice. The focused cardiac destination is part of UltrasoundExpo™ and is administered through its approved exhibitor pathway.</p><Button asChild className="mt-8 h-12 bg-[#0b9fa5] px-6 font-bold hover:bg-[#098a90]"><a href={ECHO_EXPO_EXHIBIT_PATH}>Apply to exhibit at EchoExpo™ <ArrowRight className="ml-2 h-4 w-4" /></a></Button></div><aside className="rounded-[2rem] bg-[#062b3a] p-8 text-white shadow-xl shadow-cyan-900/20"><p className="text-xs font-black uppercase tracking-[.18em] text-[#81eee8]">Partner pathway</p><h3 className="mt-3 text-3xl font-black">One approved portal. Clear event choices.</h3><p className="mt-4 leading-7 text-slate-300">Vendor approval, private opportunity details, booth resources, selections, and secure payment stay in the UltrasoundExpo™ partner portal. Choose the EchoExpo™ event pathway in your application and the event workspace.</p><a className="mt-7 inline-flex items-center gap-2 font-bold text-[#9cf2ed] hover:text-white" href={`${ULTRASOUND_EXPO}/vendor-portal`}>Open the partner portal <ArrowRight className="h-4 w-4" /></a></aside></div></section>

      <section id="program" className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><div className="rounded-[2rem] bg-[#071f2d] px-7 py-12 text-white sm:px-12"><p className="text-xs font-black uppercase tracking-[.2em] text-[#7fe8e3]">Part of something bigger</p><h2 className="mt-3 max-w-3xl text-4xl font-black tracking-[-.05em] sm:text-5xl">EchoExpo™ is a dedicated experience within UltrasoundExpo™.</h2><p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">Event operations, attendee records, vendor approvals, and attendee/exhibitor choices are managed securely through UltrasoundExpo.com. EchoExpo™ provides the focused cardiac marketing destination and pathway into that shared annual event experience.</p><a href={ULTRASOUND_EXPO} className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#0b9fa5] px-5 py-3 font-bold text-white hover:bg-[#098a90]">Visit UltrasoundExpo™ <ArrowRight className="h-4 w-4" /></a></div></section>
    </main>
    <footer className="bg-[#041923] px-4 py-10 text-slate-300 sm:px-6"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row"><div><p className="font-black text-white">EchoExpo™ <span className="text-[#8bece7]">by iHeartEcho™</span></p><p className="mt-1 text-sm">A dedicated experience within UltrasoundExpo™.</p></div><a href="mailto:support@allaboutultrasound.com" className="text-sm font-bold text-[#9cefea] hover:text-white">support@allaboutultrasound.com</a></div></footer>
  </div>;
}

function Fact({ label, value, icon: Icon }: { label: string; value: string; icon: typeof CalendarDays }) { return <div className="flex items-center gap-3 p-5"><div className="rounded-lg bg-[#e8f7f8] p-2"><Icon className="h-5 w-5 text-[#087f8c]" /></div><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#087f8c]">{label}</p><p className="mt-1 font-bold text-slate-900">{value}</p></div></div>; }
function Experience({ icon: Icon, title, text }: { icon: typeof HeartPulse; title: string; text: string }) { return <article className="rounded-2xl border border-cyan-100 bg-white p-6 shadow-[0_12px_36px_rgba(10,68,76,.06)]"><Icon className="h-7 w-7 text-[#087f8c]" /><h3 className="mt-5 text-xl font-black text-[#062b3a]">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></article>; }
