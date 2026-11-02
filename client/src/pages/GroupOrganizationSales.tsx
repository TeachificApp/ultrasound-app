import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  GraduationCap,
  HeartHandshake,
  Loader2,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";

const SALES_OPTIONS = [
  {
    id: "professional_access" as const,
    icon: Stethoscope,
    eyebrow: "Professional access",
    title: "Give your professionals a stronger everyday resource.",
    description:
      "Create a dependable home for clinical tools, protocols, cases, study resources, and Premium access across All About Ultrasound™ and iHeartEcho™.",
    highlights: ["Seat-based access for your team", "Centralized invitation and management", "Ultrasound, echo, or both"],
  },
  {
    id: "course_quiz_access" as const,
    icon: BookOpenCheck,
    eyebrow: "Group course access",
    title: "Bring a shared curriculum to the people who need it.",
    description:
      "Explore group enrollment for courses, quizzes, and focused learning resources, with an approach that fits your department, program, or clinical pathway.",
    highlights: ["Course and quiz access", "Group enrollment options", "Designed around learning goals"],
  },
  {
    id: "organization_workspace" as const,
    icon: Building2,
    eyebrow: "Organization access",
    title: "Create your organization’s own learning environment.",
    description:
      "Use a private organization space to bring together learners, modules, activities, shared resources, and the people guiding their progress.",
    highlights: ["Private organization groups", "Member and activity management", "Modules and TEACH activities"],
  },
  {
    id: "onsite_hands_on_training" as const,
    icon: MapPin,
    eyebrow: "Hands-on training",
    title: "Explore training that comes to your facility.",
    description:
      "Start a conversation about educator-led, hands-on ultrasound or echocardiography training designed around your setting, team, and clinical focus.",
    highlights: ["On-site planning conversation", "Focused on your team’s needs", "Clinical education support"],
  },
] as const;

const ADDITIONAL_INTEREST = {
  id: "group_learning" as const,
  label: "Group learning or cohort support",
  description: "Coordinated learning for a defined group, including cohort-style support and scheduled learning experiences.",
};

type InterestId = (typeof SALES_OPTIONS)[number]["id"] | typeof ADDITIONAL_INTEREST.id;
type BrandPreference = "aaus" | "iheartecho" | "dual";

const BRAND_OPTIONS: Array<{ value: BrandPreference; label: string; description: string }> = [
  { value: "aaus", label: "All About Ultrasound™", description: "General, vascular, OB/GYN, POCUS, and more" },
  { value: "iheartecho", label: "iHeartEcho™", description: "Echocardiography education and clinical intelligence" },
  { value: "dual", label: "Both platforms", description: "Ultrasound and echocardiography access" },
];

const TEAM_SIZE_OPTIONS = [1, 5, 10, 25, 50, 100, 250, 500] as const;

export default function GroupOrganizationSales() {
  const [organization, setOrganization] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [seatEstimate, setSeatEstimate] = useState(10);
  const [brand, setBrand] = useState<BrandPreference>("dual");
  const [interests, setInterests] = useState<InterestId[]>([]);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitInquiry = trpc.team.submitInquiry.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (error) => toast.error(error.message || "We could not send your request. Please try again or email support@allaboutultrasound.com."),
  });

  const toggleInterest = (interest: InterestId) => {
    setInterests((current) => current.includes(interest)
      ? current.filter((item) => item !== interest)
      : [...current, interest]);
  };

  const startWithOption = (interest: InterestId) => {
    setInterests((current) => current.includes(interest) ? current : [...current, interest]);
    document.getElementById("group-sales-inquiry")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (interests.length === 0) {
      toast.error("Select at least one area of interest so we can route your request correctly.");
      return;
    }

    submitInquiry.mutate({
      orgName: organization.trim(),
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim() || undefined,
      seatEstimate,
      brand,
      plan: "custom",
      interests,
      message: message.trim() || undefined,
    });
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7fbfc] text-slate-900">
      <header className="border-b border-white/15 bg-[#062b3a] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="group inline-flex items-center gap-3" aria-label="All About Ultrasound home">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#1ca6aa] text-sm font-black shadow-lg shadow-cyan-950/30">AA</span>
            <span className="hidden text-sm font-bold tracking-wide text-white sm:inline">All About Ultrasound™ <span className="font-normal text-cyan-200">| iHeartEcho™</span></span>
          </Link>
          <a href="#group-sales-inquiry" className="inline-flex items-center gap-2 rounded-lg border border-white/35 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20">
            Talk with our team <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-[#063f4b] text-white">
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_12%_18%,rgba(74,217,224,.45),transparent_23%),radial-gradient(circle_at_83%_18%,rgba(28,166,170,.35),transparent_24%),radial-gradient(circle_at_72%_88%,rgba(255,255,255,.12),transparent_22%)]" />
        <div className="absolute inset-y-0 right-[-12rem] w-[34rem] rounded-full border border-cyan-100/10 bg-cyan-300/5" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100/25 bg-white/10 px-4 py-2 text-sm font-semibold text-cyan-50">
              <UsersRound className="h-4 w-4" /> For departments, programs, and healthcare organizations
            </div>
            <h1 className="mt-6 max-w-3xl font-serif text-4xl font-bold leading-[1.08] tracking-[-.03em] sm:text-5xl lg:text-6xl">
              Professional learning that moves your whole team forward.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-cyan-50 sm:text-xl">
              Every ultrasound professional has a challenging scan, an unfamiliar finding, a technique they have not practiced in a while, or a question they wish they could ask. A stronger learning plan gives your entire team a trusted next step.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#group-sales-inquiry" className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 font-bold text-[#087b86] shadow-xl shadow-cyan-950/25 transition hover:-translate-y-0.5 hover:bg-cyan-50">
                Explore options for your team <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a href="#how-it-works" className="inline-flex items-center justify-center rounded-xl border border-white/35 bg-white/10 px-5 py-3 font-bold text-white transition hover:bg-white/20">
                How it works
              </a>
            </div>
            <p className="mt-5 text-sm text-cyan-100/80">No account or payment is required to start the conversation.</p>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:justify-self-end">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-cyan-300/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/[.12] p-5 shadow-2xl backdrop-blur-sm sm:p-7">
              <div className="flex items-center justify-between gap-4 border-b border-white/15 pb-5">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[.18em] text-cyan-200">A flexible starting point</p>
                  <h2 className="mt-2 text-2xl font-bold">Build the right access and pricing mix.</h2>
                </div>
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15"><HeartHandshake className="h-6 w-6 text-cyan-100" /></div>
              </div>
              <div className="mt-5 space-y-3">
                <HeroChecklist title="Professional access" text="Tools and learning resources for the people who use them every day." />
                <HeroChecklist title="Group courses and quizzes" text="Focused enrollment for a shared curriculum or competency goal." />
                <HeroChecklist title="Organization learning space" text="A private environment to coordinate people, activities, and progress." />
                <HeroChecklist title="Hands-on training" text="Explore a tailored on-site education conversation for your facility." />
              </div>
              <div className="mt-6 rounded-2xl border border-cyan-100/20 bg-[#042c37]/45 p-4 text-sm leading-6 text-cyan-50">
                When your team grows, your department benefits.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-cyan-100 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:grid-cols-3 sm:px-6 lg:px-8">
          <TrustItem icon={ShieldCheck} title="Built for professional teams" text="Designed for organizations that want a clear, supported path to continued learning." />
          <TrustItem icon={BadgeCheck} title="Flexible by design" text="Start with Premium access, a focused course plan, organization space, or a conversation about training." />
          <TrustItem icon={HeartHandshake} title="A real person follows up" text="Tell us what your team needs. We will help identify an appropriate next step." />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#087f8c]">Choose your starting point</p>
          <h2 className="mt-3 font-serif text-3xl font-bold tracking-[-.03em] text-[#062634] sm:text-4xl">Educational resources should be easier for teams to access, apply, and grow with.</h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">Whether your team is strengthening foundational knowledge, exploring new concepts, or planning a larger learning initiative, we can help you start with the path and group pricing approach that make sense for your organization.</p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {SALES_OPTIONS.map(({ id, icon: Icon, eyebrow, title, description, highlights }) => (
            <article key={id} className="group flex h-full flex-col rounded-3xl border border-cyan-100 bg-white p-6 shadow-[0_10px_32px_rgba(8,84,91,.07)] transition duration-200 hover:-translate-y-1 hover:border-[#1ca6aa]/50 hover:shadow-[0_18px_42px_rgba(8,84,91,.12)] sm:p-7">
              <div className="flex items-start justify-between gap-5">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eafafb] text-[#087f8c]"><Icon className="h-6 w-6" /></div>
                <span className="rounded-full bg-[#effbfc] px-3 py-1 text-xs font-bold text-[#087f8c]">{eyebrow}</span>
              </div>
              <h3 className="mt-6 text-xl font-black leading-7 text-[#062634]">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
              <ul className="mt-5 space-y-2 text-sm text-slate-600">
                {highlights.map((highlight) => <li key={highlight} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#14999d]" />{highlight}</li>)}
              </ul>
              <button type="button" onClick={() => startWithOption(id)} className="mt-7 inline-flex items-center gap-2 self-start text-sm font-bold text-[#087f8c] transition hover:text-[#055b65]">
                Ask about this option <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="border-y border-cyan-100 bg-[#ecf9fa] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-[#087f8c]">How it works</p>
              <h2 className="mt-3 font-serif text-3xl font-bold tracking-[-.03em] text-[#062634]">A clear next step for your department.</h2>
              <p className="mt-4 max-w-md leading-7 text-slate-600">Start with the team you have today, then shape an education plan around your learning priorities, access needs, and clinical environment.</p>
            </div>
            <ol className="grid gap-4 sm:grid-cols-3">
              <ProcessStep number="01" title="Tell us what matters" text="Share your organization, approximate team size, and the learning or access goals you want to solve." />
              <ProcessStep number="02" title="Explore the right fit" text="We will help clarify relevant group access, course, organization, or training options." />
              <ProcessStep number="03" title="Build momentum" text="Move forward with an approach that supports the professionals and learners in your department." />
            </ol>
          </div>
        </div>
      </section>

      <section id="group-sales-inquiry" className="scroll-mt-6 bg-[#062b3a] px-4 py-16 text-white sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.86fr_1.14fr] lg:items-start">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100/25 bg-white/10 px-4 py-2 text-sm font-semibold text-cyan-50"><Sparkles className="h-4 w-4" /> Start the conversation</div>
            <h2 className="mt-5 font-serif text-3xl font-bold tracking-[-.03em] sm:text-4xl">Ready to explore educational opportunities for your team?</h2>
            <p className="mt-5 text-base leading-7 text-cyan-50/90">Tell us a little about your organization and what you are working toward. We will use your selections to route the conversation to the appropriate team.</p>
            <div className="mt-8 space-y-4 border-l border-cyan-200/30 pl-5 text-sm leading-6 text-cyan-50/85">
              <p><strong className="text-white">Ultrasound departments</strong> planning broader professional access or targeted learning support.</p>
              <p><strong className="text-white">Clinical educators and programs</strong> coordinating group learning, organization spaces, or course access.</p>
              <p><strong className="text-white">Healthcare organizations</strong> exploring hands-on training at their own facility.</p>
            </div>
            <p className="mt-8 flex items-center gap-2 text-sm text-cyan-100"><Mail className="h-4 w-4" /> Prefer email? Reach us at <a className="font-bold text-white underline decoration-cyan-300/70 underline-offset-4 hover:text-cyan-200" href="mailto:support@allaboutultrasound.com">support@allaboutultrasound.com</a>.</p>
          </div>

          <div className="rounded-[2rem] bg-white p-6 text-slate-900 shadow-2xl shadow-cyan-950/30 sm:p-8">
            {submitted ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-[#e9fafb]"><CheckCircle2 className="h-9 w-9 text-[#12969b]" /></div>
                <h3 className="mt-6 text-2xl font-black text-[#062634]">Thank you, {contactName || "there"}.</h3>
                <p className="mt-3 max-w-md leading-7 text-slate-600">Your request has been received. A confirmation was sent to your email, and our team will follow up about the options most relevant to your organization.</p>
                <Button type="button" variant="outline" className="mt-7 border-[#14999d] text-[#087f8c] hover:bg-[#effbfc]" onClick={() => { setSubmitted(false); setInterests([]); setMessage(""); }}>
                  Submit another request
                </Button>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                <div>
                  <p className="text-sm font-black uppercase tracking-[.16em] text-[#087f8c]">Group & organization inquiry</p>
                  <h3 className="mt-2 text-2xl font-black tracking-[-.02em] text-[#062634]">Tell us about your team.</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Fields marked with * help us route your request. You can choose more than one area of interest.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Organization / institution" required htmlFor="group-sales-org"><Input id="group-sales-org" required value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="City Medical Center" /></Field>
                  <Field label="Your name" required htmlFor="group-sales-name"><Input id="group-sales-name" required value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Jane Smith" /></Field>
                  <Field label="Work email" required htmlFor="group-sales-email"><Input id="group-sales-email" type="email" required value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="jane@organization.org" /></Field>
                  <Field label="Phone" htmlFor="group-sales-phone"><Input id="group-sales-phone" type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="(555) 000-0000" /></Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Approximate number of learners" required htmlFor="group-sales-size">
                    <select id="group-sales-size" value={seatEstimate} onChange={(event) => setSeatEstimate(Number(event.target.value))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      {TEAM_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size === 500 ? "500+" : size}</option>)}
                    </select>
                  </Field>
                  <Field label="Platform focus" required htmlFor="group-sales-brand">
                    <select id="group-sales-brand" value={brand} onChange={(event) => setBrand(event.target.value as BrandPreference)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      {BRAND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </Field>
                </div>

                <fieldset>
                  <legend className="text-sm font-semibold text-slate-700">What would you like to explore? <span className="text-rose-600">*</span></legend>
                  <p className="mt-1 text-xs text-slate-500">Select every area that applies.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[...SALES_OPTIONS.map(({ id, icon: Icon, eyebrow, description }) => ({ id, label: eyebrow, description, icon: Icon })), { id: ADDITIONAL_INTEREST.id, label: ADDITIONAL_INTEREST.label, description: ADDITIONAL_INTEREST.description, icon: GraduationCap }].map(({ id, label, description, icon: Icon }) => {
                      const selected = interests.includes(id);
                      return (
                        <Tooltip key={id}>
                          <TooltipTrigger asChild>
                            <button type="button" onClick={() => toggleInterest(id)} aria-pressed={selected} aria-label={`${label}. ${description}`} className={`flex items-center gap-3 rounded-xl border p-3 text-left text-sm font-semibold transition ${selected ? "border-[#14999d] bg-[#effbfc] text-[#076a73] ring-1 ring-[#14999d]/20" : "border-slate-200 bg-white text-slate-700 hover:border-[#14999d]/50 hover:bg-slate-50"}`}>
                              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${selected ? "bg-[#14999d] text-white" : "bg-slate-100 text-slate-500"}`}><Icon className="h-4 w-4" /></span>
                              <span>{label}</span>
                              <CircleHelp className={`ml-auto h-4 w-4 shrink-0 ${selected ? "text-[#087f8c]" : "text-slate-400"}`} aria-hidden="true" />
                              {selected && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={8} className="max-w-xs bg-[#062634] px-3 py-2 text-left text-xs leading-5 text-white shadow-lg">
                            {description}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </fieldset>

                <Field label="Anything else we should know?" htmlFor="group-sales-message">
                  <Textarea id="group-sales-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us about your clinical focus, current training priorities, preferred timeframe, or questions." rows={4} className="resize-none" />
                </Field>

                <Button type="submit" disabled={submitInquiry.isPending} className="w-full bg-[#14999d] py-6 font-bold text-white shadow-lg shadow-[#14999d]/20 hover:bg-[#087f8c]">
                  {submitInquiry.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending your request…</> : <>Request organization information <ArrowRight className="ml-2 h-4 w-4" /></>}
                </Button>
                <p className="text-center text-xs leading-5 text-slate-500">By submitting, you agree to be contacted by All About Ultrasound™ | iHeartEcho™ about the education and access options you selected.</p>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function HeroChecklist({ title, text }: { title: string; text: string }) {
  return <div className="flex gap-3 rounded-2xl border border-white/10 bg-[#042f3b]/35 p-3.5"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" /><div><p className="font-bold text-white">{title}</p><p className="mt-0.5 text-sm leading-5 text-cyan-50/80">{text}</p></div></div>;
}

function TrustItem({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="flex gap-3 rounded-2xl p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#effbfc] text-[#087f8c]"><Icon className="h-5 w-5" /></span><div><h3 className="text-sm font-black text-[#062634]">{title}</h3><p className="mt-1 text-sm leading-5 text-slate-600">{text}</p></div></div>;
}

function ProcessStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <li className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm"><span className="text-xs font-black tracking-[.18em] text-[#14999d]">{number}</span><h3 className="mt-3 font-black text-[#062634]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></li>;
}

function Field({ label, required = false, htmlFor, children }: { label: string; required?: boolean; htmlFor: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={htmlFor} className="text-sm font-semibold text-slate-700">{label}{required && <span className="text-rose-600"> *</span>}</Label>{children}</div>;
}
