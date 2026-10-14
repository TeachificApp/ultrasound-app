import { useEffect, useRef, useState } from "react";
import { BookOpen, CalendarDays, ChevronRight, CreditCard, LayoutDashboard, PlayCircle, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MY_CONTENT_URL = "/my-dashboard?tab=content";
const SUBSCRIPTIONS_URL = "/my-dashboard?tab=subscriptions";

function createVisitKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `learn-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function GuideFrame({
  icon: Icon,
  eyebrow,
  title,
  children,
  accent = "teal",
}: {
  icon: typeof LayoutDashboard;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  accent?: "teal" | "amber" | "violet";
}) {
  const accents = {
    teal: "bg-teal-50 text-teal-700 ring-teal-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ring-1 ${accents[accent]}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{eyebrow}</p>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        </div>
      </div>
      {children}
    </section>
  );
}

function MiniScreen({ children, highlight }: { children: React.ReactNode; highlight: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex h-6 items-center gap-1 border-b border-slate-200 bg-white px-2.5">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
        <span className="ml-1.5 truncate text-[8px] font-medium text-slate-400">Learning Platform</span>
      </div>
      <div className="p-2.5">{children}</div>
      <div className="border-t border-slate-200 bg-white px-2.5 py-1.5 text-[9px] font-semibold text-teal-700">
        {highlight}
      </div>
    </div>
  );
}

/**
 * Account-aware orientation guide for learners with usable Learn content. The
 * server records qualifying visit count in MySQL so it appears only on the
 * first three Learn visits, including across separate browsers/devices.
 */
export default function LearnerAccessGuide() {
  const { isAuthenticated, loading, user } = useAuth();
  const [open, setOpen] = useState(false);
  const attempted = useRef(false);
  const visitKey = useRef(createVisitKey());
  const registerVisit = trpc.dashboard.registerLearnOnboardingVisit.useMutation({
    onSuccess: (result) => setOpen(result.shouldShow),
  });

  const roles = (user as any)?.appRoles ?? [];
  const isAdmin = (user as any)?.role === "admin" || roles.includes("platform_admin") || roles.includes("platform_manager");

  useEffect(() => {
    if (loading || !isAuthenticated || isAdmin || attempted.current) return;
    attempted.current = true;
    registerVisit.mutate({ visitKey: visitKey.current });
  }, [isAuthenticated, isAdmin, loading, registerVisit]);

  const goTo = (url: string) => {
    setOpen(false);
    window.location.assign(url);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[min(780px,calc(100vh-1.5rem))] max-w-4xl overflow-y-auto border-teal-100 bg-[#f8fcfc] p-0 shadow-2xl" showCloseButton={false}>
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0d777d] via-[#15989d] to-[#36b4b5] px-5 pb-6 pt-6 text-white sm:px-8 sm:pt-8">
          <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/10" />
          <div className="absolute -bottom-24 left-1/2 h-40 w-72 rounded-full bg-cyan-200/10" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Dismiss access guide"
          >
            <X className="h-4 w-4" />
          </button>
          <DialogHeader className="relative max-w-2xl text-left">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-100">Your Learn access guide</p>
            <DialogTitle className="font-serif text-2xl leading-tight text-white sm:text-3xl">Your learning is ready when you are.</DialogTitle>
            <DialogDescription className="mt-2 max-w-xl text-sm leading-6 text-teal-50">
              Here is the quickest way to find your courses, quizzes, downloads, registrations, and account details. You can close this guide at any time.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <GuideFrame icon={LayoutDashboard} eyebrow="Step 1" title="Open My Dashboard">
              <MiniScreen highlight="Select My Dashboard from your account menu">
                <div className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 shadow-sm">
                  <span className="text-[9px] font-bold text-teal-700">Learning Platform</span>
                  <span className="rounded-md bg-teal-50 px-1.5 py-0.5 text-[8px] font-semibold text-teal-700">Account ▾</span>
                </div>
                <div className="mt-2 rounded-lg border border-teal-200 bg-teal-50 px-2 py-1.5 text-[9px] font-bold text-teal-800 ring-2 ring-teal-300/70">
                  <LayoutDashboard className="mr-1 inline h-3 w-3" /> My Dashboard
                </div>
              </MiniScreen>
              <p className="mt-3 text-xs leading-5 text-slate-600">Use the account menu in the upper-right corner on any Learn page.</p>
            </GuideFrame>

            <GuideFrame icon={BookOpen} eyebrow="Step 2" title="Choose My Content" accent="violet">
              <MiniScreen highlight="My Content holds every item assigned to your account">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-800">My Dashboard</span>
                  <span className="h-2 w-9 rounded bg-slate-200" />
                </div>
                <div className="rounded-lg bg-teal-600 px-2 py-1.5 text-[9px] font-bold text-white">My Content</div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <span className="rounded bg-white px-1.5 py-1 text-[8px] text-slate-600">Courses</span>
                  <span className="rounded bg-white px-1.5 py-1 text-[8px] text-slate-600">Downloads</span>
                  <span className="rounded bg-white px-1.5 py-1 text-[8px] text-slate-600">Quizzes</span>
                  <span className="rounded bg-white px-1.5 py-1 text-[8px] text-slate-600">Events</span>
                </div>
              </MiniScreen>
              <p className="mt-3 text-xs leading-5 text-slate-600">Open the matching tab to launch an item you purchased or were assigned.</p>
            </GuideFrame>

            <GuideFrame icon={CreditCard} eyebrow="Step 3" title="Manage billing" accent="amber">
              <MiniScreen highlight="My Dashboard → Subscriptions">
                <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 text-[9px] text-slate-500">
                  <span>My Content</span><span>Profile</span><span className="font-bold text-teal-700">Subscriptions</span>
                </div>
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                  <div className="flex items-center justify-between"><span className="text-[8px] font-bold text-slate-700">Your plan</span><span className="text-[8px] font-bold text-emerald-700">Active</span></div>
                  <div className="mt-1.5 h-1.5 w-4/5 rounded bg-amber-200" />
                  <div className="mt-1 h-1.5 w-3/5 rounded bg-amber-100" />
                </div>
              </MiniScreen>
              <p className="mt-3 text-xs leading-5 text-slate-600">Review subscriptions, invoices, and renewal or cancellation details here.</p>
            </GuideFrame>
          </div>

          {registerVisit.data?.hasCohortAccess && (
            <div className="flex flex-col gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm"><CalendarDays className="h-5 w-5" /></span>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">You also have a cohort</h3>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">Open <strong>My Cohort</strong> from your cohort course to see the schedule, live sessions, recordings, assignments, resources, and Course Modules.</p>
                </div>
              </div>
              <Button type="button" variant="outline" className="shrink-0 border-cyan-300 bg-white text-cyan-800 hover:bg-cyan-100" onClick={() => goTo(MY_CONTENT_URL)}>
                Find My Cohort <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center text-xs text-slate-500 sm:text-left">This guide is available for your first three Learn visits.</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="ghost" className="text-slate-600" onClick={() => setOpen(false)}>Maybe later</Button>
              <Button type="button" className="bg-teal-700 text-white hover:bg-teal-800" onClick={() => goTo(MY_CONTENT_URL)}>
                <PlayCircle className="mr-2 h-4 w-4" /> Open My Content
              </Button>
              <Button type="button" variant="outline" className="border-teal-300 bg-white text-teal-800 hover:bg-teal-50" onClick={() => goTo(SUBSCRIPTIONS_URL)}>
                <CreditCard className="mr-2 h-4 w-4" /> Billing & subscriptions
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
