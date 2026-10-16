import { ArrowLeft, CalendarClock } from "lucide-react";
import { Link } from "wouter";
import { useSeoHead } from "@/hooks/useSeoHead";
import { isEchoExpoDomain } from "@/hooks/useSubdomain";
import { getUltrasoundExpoPageSeo, ULTRASOUND_EXPO_EVENT_DATES_LABEL, ULTRASOUND_EXPO_LOCATION_LABEL, ULTRASOUND_EXPO_NAME, ULTRASOUND_EXPO_ORIGIN } from "@shared/ultrasoundExpo";

export default function UltrasoundExpoRegister() {
  const isEchoExpo = isEchoExpoDomain() || new URLSearchParams(window.location.search).get("event") === "echoexpo";
  const eventName = isEchoExpo ? "EchoExpo™" : "UltrasoundExpo™";
  const seo = getUltrasoundExpoPageSeo("register");
  useSeoHead({
    title: seo.title,
    description: seo.description,
    image: seo.image,
    canonical: isEchoExpo ? "https://echoexpo.iheartecho.com/register" : `${ULTRASOUND_EXPO_ORIGIN}/register`,
    siteName: eventName,
    appendSiteName: false,
    keywords: "UltrasoundExpo attendee registration, ultrasound conference",
  });

  return <div className="min-h-screen bg-[#f3fafb] text-slate-900">
    <header className="border-b border-cyan-100 bg-[#062634] text-white"><div className="mx-auto flex max-w-6xl items-center px-4 py-4 sm:px-6"><Link href="/" className="font-black tracking-[-.04em]">{isEchoExpo ? <>Echo<span className="text-[#72e1de]">Expo™</span></> : <>Ultrasound<span className="text-[#72e1de]">Expo™</span></>}</Link></div></header>
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-20">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#087f8c] hover:text-[#065f68]"><ArrowLeft className="h-4 w-4" /> Back to {eventName}</Link>
      <section className="mt-8 rounded-3xl border border-cyan-100 bg-white px-6 py-12 text-center shadow-[0_16px_42px_rgba(4,66,74,.1)] sm:px-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e4f8f8]"><CalendarClock className="h-7 w-7 text-[#087f8c]" /></div>
        <h1 className="mt-6 text-3xl font-black tracking-[-.05em] text-[#062634] sm:text-5xl">{eventName} attendee registration coming soon</h1>
        <p className="mt-5 text-sm font-black uppercase tracking-[.16em] text-[#087f8c]">{ULTRASOUND_EXPO_EVENT_DATES_LABEL} · {ULTRASOUND_EXPO_LOCATION_LABEL}</p>
        {isEchoExpo && <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600">EchoExpo™ is the dedicated cardiac ultrasound and echocardiography experience within UltrasoundExpo™. Your future EchoExpo™ registration will be managed here in the unified UltrasoundExpo™ dashboard.</p>}
      </section>
    </main>
  </div>;
}
