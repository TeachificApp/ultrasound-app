/**
 * CourseLanding.tsx
 * Public course landing page — renders blocks from the page builder when available,
 * falls back to the auto-generated layout.
 * Route: /learn/:slug
 */
import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { BookOpen, CheckCircle, ChevronRight, Clock, Download, HelpCircle, Lock, PlayCircle, Star, Users, AlertTriangle, Globe, LayoutGrid, Layers, BookMarked, Timer, Tag, CreditCard, List } from "lucide-react";
import OrderBumpOffer from "@/components/OrderBumpOffer";
import type { Block } from "./admin/LandingPageBuilder";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ReactNode> = {
  course: <BookOpen className="w-5 h-5" />,
  quiz: <HelpCircle className="w-5 h-5" />,
  download: <Download className="w-5 h-5" />,
};

function formatPrice(c: any): string {
  const pt = c?.pricingType ?? (c?.isFree ? "free" : "one_time");
  if (pt === "free") return "Free";
  if (pt === "trial_then_subscription") {
    const trialDays = c.trialDays ?? 7;
    const intervalLabel: Record<string, string> = { monthly: "/mo", quarterly: "/qtr", annual: "/yr" };
    return `${trialDays}-day free trial, then $${(c.price / 100).toFixed(0)}${intervalLabel[c.subscriptionInterval ?? "monthly"] ?? "/mo"}`;
  }
  if (pt === "subscription") {
    const intervalLabel: Record<string, string> = { monthly: "/mo", quarterly: "/qtr", annual: "/yr" };
    return `$${(c.price / 100).toFixed(0)}${intervalLabel[c.subscriptionInterval ?? "monthly"] ?? "/mo"}`;
  }
  if (pt === "payment_plan") {
    const dp = c.downPayment ? `$${(c.downPayment / 100).toFixed(0)} down` : "";
    const inst = c.installmentCount && c.installmentAmount
      ? ` + ${c.installmentCount}×$${(c.installmentAmount / 100).toFixed(0)}`
      : "";
    return dp + inst || `$${(c.price / 100).toFixed(0)}`;
  }
  return `$${(c.price / 100).toFixed(0)}`;
}

function accessLabel(c: any): string {
  const days = c?.accessDurationDays;
  if (!days || days === 0) return "Full lifetime access";
  if (days <= 30) return `${days}-day access`;
  if (days <= 365) return `${Math.round(days / 30)}-month access`;
  if (days === 365) return "1-year access";
  return `${Math.round(days / 365)}-year access`;
}

// ─── Countdown Timer Component ────────────────────────────────────────────────

function CountdownTimer({ targetDate, textColor }: { targetDate: string; textColor: string }) {
  const [time, setTime] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  useEffect(() => {
    const target = new Date(targetDate).getTime();
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setTime({ days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000), mins: Math.floor((diff % 3600000) / 60000), secs: Math.floor((diff % 60000) / 1000) });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return (
    <div className="flex justify-center gap-4">
      {[["Days", time.days], ["Hours", time.hours], ["Mins", time.mins], ["Secs", time.secs]].map(([label, val]) => (
        <div key={label as string} className="bg-white/20 rounded-xl px-6 py-4 min-w-[80px] text-center">
          <div className="text-4xl font-bold" style={{ color: textColor }}>{String(val).padStart(2, "0")}</div>
          <div className="text-sm opacity-80 mt-1" style={{ color: textColor }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Block Renderer ────────────────────────────────────────────────────────────

function RenderBlock({ block, course, onEnroll, enrolling, ctaText, price }: {
  block: Block; course: any; onEnroll: () => void; enrolling: boolean; ctaText: string; price: string;
}) {
  const d = block.data;
  switch (block.type) {
    case "hero": {
      const bgType = d.bgType ?? "color";
      let heroBg: React.CSSProperties = {};
      if (bgType === "color") heroBg = { backgroundColor: d.bgColor ?? "#179ca3" };
      else if (bgType === "gradient") heroBg = { background: `linear-gradient(${d.gradientDir ?? "to bottom right"}, ${d.gradientFrom ?? "#179ca3"}, ${d.gradientTo ?? "#0e4a50"})` };
      else if (bgType === "image") heroBg = { backgroundImage: `url(${d.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
      else if (bgType === "video") heroBg = { backgroundColor: "#000" };
      const buttons: Array<{ text: string; color: string; textColor: string; link: string; style: string }> =
        d.buttons?.length ? d.buttons : [{ text: d.ctaText ?? "Enroll Now", color: "#fff", textColor: "#179ca3", link: "", style: "filled" }];
      return (
        <div className="relative px-8 py-16 overflow-hidden" style={{ ...heroBg, color: d.textColor ?? "#fff", textAlign: d.align ?? "left" }}>
          {bgType === "video" && d.videoUrl && (
            <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover opacity-60"><source src={d.videoUrl} /></video>
          )}
          <div className="relative max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold mb-4 leading-tight">{d.headline}</h1>
            {d.subheadline && <p className="text-xl opacity-90 mb-8">{d.subheadline}</p>}
            <div className="flex flex-wrap gap-3" style={{ justifyContent: d.align === "center" ? "center" : d.align === "right" ? "flex-end" : "flex-start" }}>
              {buttons.map((btn, i) => (
                <button key={i} onClick={btn.link ? () => window.location.href = btn.link : onEnroll}
                  className="px-8 py-3 rounded-lg font-semibold text-lg shadow-lg transition-opacity hover:opacity-90"
                  style={btn.style === "outline" ? { backgroundColor: "transparent", color: btn.color, border: `2px solid ${btn.color}` } : { backgroundColor: btn.color, color: btn.textColor }}>
                  {btn.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }
    case "text":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff", color: d.textColor ?? "#1a1a1a", textAlign: d.align ?? "left" }}>
          <div className="max-w-3xl mx-auto prose" dangerouslySetInnerHTML={{ __html: d.html ?? "" }} />
        </div>
      );
    case "image":
      return (
        <div className="px-8 py-6 text-center">
          {d.url && <img src={d.url} alt={d.alt ?? ""} className="mx-auto rounded-lg shadow" style={{ maxWidth: d.maxWidth ?? "100%" }} />}
          {d.caption && <p className="text-sm text-gray-500 mt-2">{d.caption}</p>}
        </div>
      );
    case "video":
      return (
        <div className="px-8 py-6">
          {d.embedUrl && (
            <div className="relative w-full rounded-lg overflow-hidden shadow" style={{ paddingBottom: "56.25%" }}>
              <iframe src={d.embedUrl} className="absolute inset-0 w-full h-full" allowFullScreen title="Video" />
            </div>
          )}
          {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
        </div>
      );
    case "embed":
      return (
        <div className="px-8 py-6">
          {d.embedCode ? <div dangerouslySetInnerHTML={{ __html: d.embedCode }} style={{ height: d.height ?? 400 }} /> : null}
          {d.caption && <p className="text-sm text-gray-500 mt-2 text-center">{d.caption}</p>}
        </div>
      );
    case "gallery":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${d.columns ?? 3}, 1fr)` }}>
            {(d.images ?? []).map((img: any, i: number) => (
              <div key={i} className="rounded-lg overflow-hidden shadow">
                {img.url ? <img src={img.url} alt={img.caption ?? ""} className="w-full h-40 object-cover" /> : null}
                {img.caption && <p className="text-xs text-gray-500 p-2 text-center">{img.caption}</p>}
              </div>
            ))}
          </div>
        </div>
      );
    case "bullets":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f8fffe" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900">{d.headline}</h2>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl">
            {(d.items ?? []).map((item: string, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 text-lg" style={{ color: d.iconColor ?? "#179ca3" }}>✓</span>
                <span className="text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "numbered_list":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900">{d.headline}</h2>}
          <div className="space-y-4 max-w-2xl">
            {(d.items ?? []).map((item: string, i: number) => (
              <div key={i} className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>{i + 1}</span>
                <span className="text-gray-700 pt-1">{item}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "icon_grid":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">{d.headline}</h2>}
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${d.columns ?? 3}, 1fr)` }}>
            {(d.items ?? []).map((item: any, i: number) => (
              <div key={i} className="text-center p-4">
                <div className="text-4xl mb-3">{item.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case "testimonial":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f0fafa" }}>
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-4xl mb-4" style={{ color: d.accentColor ?? "#179ca3" }}>"</div>
            <p className="text-xl text-gray-700 italic mb-6">{d.quote}</p>
            <div className="flex items-center justify-center gap-3">
              {d.avatarUrl && <img src={d.avatarUrl} alt={d.author} className="w-10 h-10 rounded-full object-cover" />}
              <span className="font-semibold text-gray-900">{d.author}</span>
            </div>
          </div>
        </div>
      );
    case "reviews":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">{d.headline}</h2>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {(d.reviews ?? []).map((r: any, i: number) => (
              <div key={i} className="bg-gray-50 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-1 mb-2">{Array.from({ length: r.rating ?? 5 }).map((_, j) => <span key={j} className="text-yellow-400">★</span>)}</div>
                <p className="text-gray-700 mb-3 italic">"{r.text}"</p>
                <p className="text-sm font-semibold text-gray-900">— {r.name}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case "logos":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#f9fafb" }}>
          {d.headline && <p className="text-center text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">{d.headline}</p>}
          <div className="flex flex-wrap items-center justify-center gap-8">
            {(d.logos ?? []).map((logo: any, i: number) => (
              logo.url ? <img key={i} src={logo.url} alt={logo.alt ?? ""} className="h-10 object-contain opacity-70 hover:opacity-100 transition-opacity" />
                : <div key={i} className="h-10 w-24 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400">{logo.alt || "Logo"}</div>
            ))}
          </div>
        </div>
      );
    case "instructor":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-3xl mx-auto flex gap-6 items-start">
            {d.avatarUrl ? <img src={d.avatarUrl} alt={d.name} className="w-24 h-24 rounded-full object-cover flex-shrink-0" />
              : <div className="w-24 h-24 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0"><Users size={32} className="text-teal-600" /></div>}
            <div>
              <h3 className="text-xl font-bold text-gray-900">{d.name}</h3>
              <p className="text-teal-600 font-medium mb-3">{d.title}</p>
              <p className="text-gray-600">{d.bio}</p>
            </div>
          </div>
        </div>
      );
    case "faq":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-gray-900">{d.headline}</h2>}
          <div className="max-w-3xl space-y-3">
            {(d.items ?? []).map((item: any, i: number) => (
              <details key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                <summary className="px-5 py-4 font-semibold text-gray-900 cursor-pointer hover:bg-gray-50">{item.q}</summary>
                <div className="px-5 py-4 text-gray-600 border-t border-gray-100">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      );
    case "countdown":
      return (
        <div className="px-8 py-10 text-center" style={{ backgroundColor: d.bgColor ?? "#179ca3" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-6" style={{ color: d.textColor ?? "#fff" }}>{d.headline}</h2>}
          {d.targetDate ? <CountdownTimer targetDate={d.targetDate} textColor={d.textColor ?? "#fff"} /> : (
            <div className="flex justify-center gap-4">
              {["Days", "Hours", "Mins", "Secs"].map(u => (
                <div key={u} className="bg-white/20 rounded-xl px-6 py-4 min-w-[80px]">
                  <div className="text-4xl font-bold" style={{ color: d.textColor ?? "#fff" }}>00</div>
                  <div className="text-sm opacity-80 mt-1" style={{ color: d.textColor ?? "#fff" }}>{u}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    case "alert": {
      const alertStyles: Record<string, string> = { info: "bg-blue-50 border-blue-300 text-blue-800", success: "bg-green-50 border-green-300 text-green-800", warning: "bg-yellow-50 border-yellow-300 text-yellow-800", error: "bg-red-50 border-red-300 text-red-800" };
      return (
        <div className={`mx-8 my-4 px-5 py-4 rounded-lg border-l-4 flex items-start gap-3 ${alertStyles[d.alertType ?? "info"] ?? alertStyles.info}`}>
          <span className="text-xl flex-shrink-0">{d.icon ?? "💡"}</span>
          <p className="font-medium">{d.text}</p>
        </div>
      );
    }
    case "flip_cards":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f8fffe" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">{d.headline}</h2>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {(d.cards ?? []).map((card: any, i: number) => (
              <div key={i} className="rounded-xl overflow-hidden shadow-sm border border-gray-200">
                <div className="p-5 font-semibold text-white text-center" style={{ backgroundColor: d.accentColor ?? "#179ca3" }}>{card.front}</div>
                <div className="p-5 text-sm text-gray-600 text-center bg-white">{card.back}</div>
              </div>
            ))}
          </div>
        </div>
      );
    case "pricing_cta":
      return (
        <div className="px-8 py-12 text-center" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-3xl font-bold text-gray-900 mb-3">{d.headline}</h2>}
          {d.subtext && <p className="text-gray-600 mb-6 max-w-xl mx-auto">{d.subtext}</p>}
          {d.showPrice && <p className="text-4xl font-bold mb-6" style={{ color: d.ctaColor ?? "#179ca3" }}>{price}</p>}
          <button onClick={onEnroll} disabled={enrolling} className="px-10 py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-60 transition-opacity hover:opacity-90" style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#fff" }}>
            {enrolling ? "Processing…" : (d.ctaText ?? ctaText)}
          </button>
        </div>
      );
    case "cta_standalone":
      return (
        <div className="px-8 py-12" style={{ backgroundColor: d.bgColor ?? "#f0fafa", textAlign: d.align ?? "center" }}>
          {d.headline && <h2 className="text-2xl font-bold text-gray-900 mb-3">{d.headline}</h2>}
          {d.subtext && <p className="text-gray-600 mb-6">{d.subtext}</p>}
          <button onClick={d.ctaLink ? () => window.location.href = d.ctaLink : onEnroll} disabled={enrolling}
            className="inline-block px-8 py-3 rounded-lg font-semibold shadow disabled:opacity-60 transition-opacity hover:opacity-90" style={{ backgroundColor: d.ctaColor ?? "#179ca3", color: d.ctaTextColor ?? "#fff" }}>
            {d.ctaText ?? ctaText}
          </button>
        </div>
      );
    case "lead_capture":
      return (
        <div className="px-8 py-12 text-center" style={{ backgroundColor: d.bgColor ?? "#179ca3", color: d.textColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-3">{d.headline}</h2>}
          {d.subtext && <p className="opacity-90 mb-6">{d.subtext}</p>}
          <div className="flex max-w-md mx-auto gap-2">
            <input type="email" placeholder="Your email address" className="flex-1 px-4 py-3 rounded-lg text-gray-900 border-0 focus:ring-2 focus:ring-white/50" />
            <button className="px-6 py-3 bg-white font-semibold rounded-lg" style={{ color: d.bgColor ?? "#179ca3" }}>{d.ctaText ?? "Send Me Access"}</button>
          </div>
        </div>
      );
    case "curriculum_auto":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-6 text-gray-900">{d.headline}</h2>}
          <div className="border border-gray-200 rounded-xl overflow-hidden max-w-3xl">
            <Accordion type="multiple" defaultValue={["section-0"]}>
              {course.sections.map((section: any, si: number) => (
                <AccordionItem key={section.id} value={`section-${si}`}>
                  <AccordionTrigger className="text-sm font-medium text-gray-800 hover:no-underline px-5">
                    <span>{section.title}</span>
                    <span className="text-xs text-gray-400 ml-auto mr-2">{section.lessons.length} lesson{section.lessons.length !== 1 ? "s" : ""}</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1 pt-1">
                      {section.lessons.map((lesson: any) => (
                        <li key={lesson.id} className="flex items-center gap-3 py-2 px-5 text-sm">
                          {lesson.isPreview ? <PlayCircle className="w-4 h-4 text-teal-500 flex-shrink-0" /> : <Lock className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                          <span className={lesson.isPreview ? "text-teal-700 font-medium" : "text-gray-700"}>{lesson.title}</span>
                          {lesson.isPreview && <Badge variant="outline" className="text-xs text-teal-600 border-teal-300 ml-auto">Preview</Badge>}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      );
    case "pricing_options_auto":
      return (
        <div className="px-8 py-10" style={{ backgroundColor: d.bgColor ?? "#f9fafb" }}>
          {d.headline && <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">{d.headline}</h2>}
          <div className="flex justify-center max-w-sm mx-auto">
            <div className="w-full border-2 border-teal-500 rounded-xl p-6 text-center shadow-lg">
              <h3 className="font-bold text-gray-900 mb-2">{course.title}</h3>
              <p className="text-3xl font-bold text-teal-600 mb-4">{price}</p>
              <button onClick={onEnroll} disabled={enrolling} className="w-full py-3 rounded-lg font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "#179ca3" }}>
                {enrolling ? "Processing…" : ctaText}
              </button>
            </div>
          </div>
        </div>
      );
    case "divider":
      return <div style={{ padding: `${d.spacing ?? 32}px 32px` }}><hr style={{ borderTop: `${d.thickness ?? 1}px ${d.style ?? "solid"} ${d.color ?? "#e5e7eb"}` }} /></div>;
    case "two_column":
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="flex gap-8">
            <div className="prose" style={{ flex: d.leftRatio ?? 50 }} dangerouslySetInnerHTML={{ __html: d.leftHtml ?? "" }} />
            <div className="prose" style={{ flex: 100 - (d.leftRatio ?? 50) }} dangerouslySetInnerHTML={{ __html: d.rightHtml ?? "" }} />
          </div>
        </div>
      );
    case "divided_columns": {
      const cols = d.columns ?? [{ html: "" }, { html: "" }];
      return (
        <div className="px-8 py-8" style={{ backgroundColor: d.bgColor ?? "#fff" }}>
          <div className="max-w-5xl mx-auto grid" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)`, gap: `${d.gap ?? 32}px` }}>
            {cols.map((col: any, i: number) => (
              <div key={i} className="prose" dangerouslySetInnerHTML={{ __html: col.html ?? "" }} />
            ))}
          </div>
        </div>
      );
    }
    case "spacer":
      return <div style={{ height: d.height ?? 48 }} />;
    default:
      return null;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CourseLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [enrolling, setEnrolling] = useState(false);

  const { data: course, isLoading } = trpc.lms.getCourse.useQuery({ slug: slug! }, { enabled: !!slug });
  const { data: myCourses } = trpc.lmsLearner.getMyCourses.useQuery(undefined, { enabled: !!user });
  const enrollment = myCourses?.find((e: any) => e.courseId === course?.id);

  const enrollFree = trpc.lmsLearner.enrollFree.useMutation({
    onSuccess: () => { toast.success("Enrolled! You now have access to this course."); navigate(`/learn/${slug}/player`); },
    onError: (e) => toast.error(`Enrollment failed: ${e.message}`),
  });
  const createCheckout = trpc.lmsLearner.createCheckout.useMutation({
    onSuccess: (data) => { if (data.checkoutUrl) window.open(data.checkoutUrl, "_blank"); },
    onError: (e) => toast.error(`Checkout failed: ${e.message}`),
  });

  const handleEnroll = async () => {
    if (!user) { navigate("/login"); return; }
    if (enrollment) { navigate(`/learn/${slug}/player`); return; }
    setEnrolling(true);
    try {
      const pt = course?.pricingType ?? (course?.isFree ? "free" : "one_time");
      if (pt === "free") await enrollFree.mutateAsync({ courseSlug: slug! });
      else await createCheckout.mutateAsync({ courseSlug: slug!, seats: 1, origin: window.location.origin });
    } finally { setEnrolling(false); }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-20 text-gray-500">
        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-lg font-medium">Course not found</p>
        <Button variant="link" onClick={() => navigate("/education-library")}>Back to Library</Button>
      </div>
    );
  }

  const lp = course.landingPage;
  const price = formatPrice(course);
  const pricingType = course.pricingType ?? (course.isFree ? "free" : "one_time");
  const ctaText = enrollment ? "Continue Learning" : (lp?.ctaText ?? "Enroll Now");
  const totalLessons = (course.sections ?? []).reduce((sum: number, s: any) => sum + (s.lessons?.length ?? 0), 0)
    + ((course as any).topLevelLessons?.length ?? 0);
  const totalDuration = (course.sections ?? []).reduce((sum: number, s: any) =>
    sum + (s.lessons ?? []).reduce((ls: number, l: any) => ls + (l.durationMinutes ?? 0), 0), 0);

  // Parse blocks from landing page
  let blocks: Block[] = [];
  if (lp?.blocks) {
    try { blocks = typeof lp.blocks === "string" ? JSON.parse(lp.blocks) : lp.blocks; } catch { blocks = []; }
  }

  // ── Blocks-based rendering ──
  if (blocks.length > 0) {
    return (
      <div className="min-h-screen bg-white">
        {blocks.map(block => (
          <RenderBlock key={block.id} block={block} course={course} onEnroll={handleEnroll} enrolling={enrolling || enrollFree.isPending || createCheckout.isPending} ctaText={ctaText} price={price} />
        ))}
        {/* Before-checkout order bump */}
        {!course.isEnrolled && course && (
          <div className="max-w-2xl mx-auto px-4 py-8">
            <OrderBumpOffer
              triggerType="course"
              triggerProductId={course.id}
              timing="before_checkout"
            />
          </div>
        )}
      </div>
    );
  }

  // ── Auto-generated fallback layout ──
  const heroColor = lp?.heroImageUrl ? undefined : "#179ca3";
  const heroBg = lp?.heroImageUrl
    ? { backgroundImage: `url(${lp.heroImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundColor: heroColor };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div style={heroBg} className="text-white">
        <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-teal-600 text-white border-0 flex items-center gap-1">
                {TYPE_ICONS[course.type]} {course.type.charAt(0).toUpperCase() + course.type.slice(1)}
              </Badge>
              <Badge variant="outline" className="border-teal-400 text-teal-200">
                {course.brand === "aaus" ? "All About Ultrasound™" : "iHeartEcho"}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold leading-tight">{lp?.heroTitle ?? course.title}</h1>
            {(lp?.heroSubtitle ?? course.subtitle) && (
              <p className="text-teal-100 text-lg">{lp?.heroSubtitle ?? course.subtitle}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-teal-200 pt-2">
              {totalLessons > 0 && <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" />{totalLessons} lesson{totalLessons !== 1 ? "s" : ""}</span>}
              {totalDuration > 0 && <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{totalDuration} min</span>}
              {course.hasCertificate && <span className="flex items-center gap-1"><Star className="w-4 h-4" />Certificate included</span>}
            </div>
            {course.instructors?.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-2">
                {course.instructors.map((ins: any) => ins && (
                  <div key={ins.id} className="flex items-center gap-2">
                    {ins.avatarUrl ? <img src={ins.avatarUrl} alt={ins.name} className="w-8 h-8 rounded-full object-cover border-2 border-teal-400" /> : <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-sm font-bold">{ins.name[0]}</div>}
                    <div><p className="text-sm font-medium">{ins.name}</p>{ins.title && <p className="text-xs text-teal-300">{ins.title}</p>}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Enrollment card */}
          <div className="bg-white rounded-xl shadow-xl p-6 text-gray-900 space-y-4">
            {course.coverImageUrl && <img src={course.coverImageUrl} alt={course.title} className="w-full h-36 object-cover rounded-lg" />}
            <div className="space-y-1">
              <div className="text-3xl font-bold text-teal-700">{price}</div>
              {pricingType === "trial_then_subscription" && (
                <p className="text-xs text-gray-500">{course.trialDays ?? 7}-day free trial, then billed {course.subscriptionInterval ?? "monthly"}</p>
              )}
              {pricingType === "subscription" && <p className="text-xs text-gray-500">Billed {course.subscriptionInterval ?? "monthly"} — cancel anytime</p>}
              {pricingType === "payment_plan" && course.downPayment && (
                <p className="text-xs text-gray-500">${(course.downPayment / 100).toFixed(0)} due today{course.installmentCount && course.installmentAmount ? `, then ${course.installmentCount}×$${(course.installmentAmount / 100).toFixed(0)} every ${course.installmentIntervalDays ?? 30} days` : ""}</p>
              )}
              {pricingType === "free" && <p className="text-xs text-gray-500">No payment required</p>}
            </div>
            <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold" size="lg" onClick={handleEnroll} disabled={enrolling || enrollFree.isPending || createCheckout.isPending}>
              {enrolling ? "Processing..." : ctaText}<ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            {!user && (
              <p className="text-xs text-gray-500 text-center">
                <button className="text-teal-600 underline" onClick={() => navigate("/login")}>Sign in</button> or{" "}
                <button className="text-teal-600 underline" onClick={() => navigate("/register")}>create an account</button> to enroll
              </p>
            )}
            {course.hasCertificate && <div className="flex items-center gap-2 text-sm text-gray-600 border-t pt-3"><Star className="w-4 h-4 text-yellow-500" />Certificate of completion included</div>}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {lp?.whatYouLearn && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">What You'll Learn</h2>
              <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: lp.whatYouLearn }} />
            </section>
          )}
          {(lp?.bodyContent ?? course.description) && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">About This Course</h2>
              <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: lp?.bodyContent ?? course.description ?? "" }} />
            </section>
          )}
          {course.sections?.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Curriculum</h2>
              <Accordion type="multiple" defaultValue={["section-0"]}>
                {course.sections.map((section: any, si: number) => (
                  <AccordionItem key={section.id} value={`section-${si}`}>
                    <AccordionTrigger className="text-sm font-medium text-gray-800 hover:no-underline">
                      <span>{section.title}</span>
                      <span className="text-xs text-gray-400 ml-auto mr-2">{section.lessons.length} lesson{section.lessons.length !== 1 ? "s" : ""}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-1 pt-1">
                        {section.lessons.map((lesson: any) => (
                          <li key={lesson.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 text-sm">
                            {lesson.isPreview ? <PlayCircle className="w-4 h-4 text-teal-500 flex-shrink-0" /> : <Lock className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                            <span className={lesson.isPreview ? "text-teal-700 font-medium" : "text-gray-700"}>{lesson.title}</span>
                            {lesson.isPreview && <Badge variant="outline" className="text-xs text-teal-600 border-teal-300 ml-auto">Preview</Badge>}
                            {lesson.durationMinutes && <span className="text-xs text-gray-400 ml-auto">{lesson.durationMinutes} min</span>}
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          )}
          {lp?.requirements && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Requirements</h2>
              <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: lp.requirements }} />
            </section>
          )}
          {course.instructors?.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Instructor{course.instructors.length > 1 ? "s" : ""}</h2>
              <div className="space-y-6">
                {course.instructors.map((ins: any) => ins && (
                  <div key={ins.id} className="flex gap-4">
                    {ins.avatarUrl ? <img src={ins.avatarUrl} alt={ins.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" /> : <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center text-2xl font-bold text-teal-700 flex-shrink-0">{ins.name[0]}</div>}
                    <div>
                      <p className="font-semibold text-gray-900">{ins.name}</p>
                      {ins.title && <p className="text-sm text-teal-600">{ins.title}</p>}
                      {ins.bio && <div className="text-sm text-gray-600 mt-1 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: ins.bio }} />}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
        {/* Sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-6 bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="text-2xl font-bold text-teal-700">{price}</div>
            {pricingType === "trial_then_subscription" && (
              <p className="text-xs text-gray-500">{course.trialDays ?? 7}-day free trial, then billed {course.subscriptionInterval ?? "monthly"}</p>
            )}
            <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold" size="lg" onClick={handleEnroll} disabled={enrolling || enrollFree.isPending || createCheckout.isPending}>
              {enrolling ? "Processing..." : ctaText}
            </Button>
            <ul className="space-y-2 text-sm text-gray-600">
              {totalLessons > 0 && <li className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-teal-500" />{totalLessons} lessons</li>}
              {totalDuration > 0 && <li className="flex items-center gap-2"><Clock className="w-4 h-4 text-teal-500" />{totalDuration} minutes of content</li>}
              {course.hasCertificate && <li className="flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" />Certificate of completion</li>}
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-teal-500" />{accessLabel(course)}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
