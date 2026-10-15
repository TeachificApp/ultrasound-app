import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  PlayCircle,
  X,
} from "lucide-react";
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

type PreviewId = "account" | "content" | "billing" | "cohort";

type PreviewTarget = {
  id: PreviewId;
  label: string;
  title: string;
  description: string;
  icon: typeof LayoutDashboard;
  href: string;
};

function createVisitKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `learn-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function previewUrl(href: string, revealAccountMenu = false) {
  const joiner = href.includes("?") ? "&" : "?";
  return `${href}${joiner}onboarding_preview=1${revealAccountMenu ? "&onboarding_preview_account=1" : ""}`;
}

/**
 * Account-aware orientation guide for learners with usable Learn content. It
 * keeps visit counts in MySQL and embeds the learner's actual authenticated
 * dashboard and cohort pages inside the guide rather than generic mock-ups.
 */
export default function LearnerAccessGuide() {
  const { isAuthenticated, loading, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [activePreview, setActivePreview] = useState<PreviewId>("account");
  const attempted = useRef(false);
  const visitKey = useRef(createVisitKey());
  const registerVisit = trpc.dashboard.registerLearnOnboardingVisit.useMutation({
    onSuccess: (result) => setOpen(result.shouldShow),
  });

  const roles = (user as any)?.appRoles ?? [];
  const isAdmin = (user as any)?.role === "admin" || roles.includes("platform_admin") || roles.includes("platform_manager");
  const isPreviewFrame = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("onboarding_preview") === "1";
  const cohortCourseId = registerVisit.data?.cohortCourseId;

  const previews = useMemo<PreviewTarget[]>(() => [
    {
      id: "account",
      label: "1. My Dashboard",
      title: "Select your name or avatar at the top-right, then choose My Dashboard",
      description: "This first preview opens the real signed-in account menu available on every Learn page and highlights My Dashboard.",
      icon: LayoutDashboard,
      href: MY_CONTENT_URL,
    },
    {
      id: "content",
      label: "2. My Content",
      title: "Find your courses, quizzes, downloads, webinars, workshops, and bundles",
      description: "This live preview shows the My Content dashboard for your signed-in account.",
      icon: BookOpen,
      href: MY_CONTENT_URL,
    },
    {
      id: "billing",
      label: "3. Subscriptions",
      title: "Review billing, invoices, renewals, and cancellation details",
      description: "Use the Subscriptions tab in My Dashboard whenever you need account or billing information.",
      icon: CreditCard,
      href: SUBSCRIPTIONS_URL,
    },
    ...(cohortCourseId ? [{
      id: "cohort" as const,
      label: "4. My Cohort",
      title: "Use your cohort workspace for live sessions, calendar, replays, assignments, and resources",
      description: "This is your actual cohort workspace, including the Course Modules link back to your course player.",
      icon: CalendarDays,
      href: `/cohort/${cohortCourseId}`,
    }] : []),
  ], [cohortCourseId]);

  const currentPreview = previews.find((preview) => preview.id === activePreview) ?? previews[0];

  useEffect(() => {
    if (isPreviewFrame || loading || !isAuthenticated || isAdmin || attempted.current) return;
    attempted.current = true;
    registerVisit.mutate({ visitKey: visitKey.current });
  }, [isAuthenticated, isAdmin, isPreviewFrame, loading, registerVisit]);

  useEffect(() => {
    if (activePreview === "cohort" && !cohortCourseId) setActivePreview("content");
  }, [activePreview, cohortCourseId]);

  const goTo = (url: string) => {
    setOpen(false);
    window.location.assign(url);
  };

  if (isPreviewFrame) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[min(860px,calc(100vh-1.5rem))] max-w-5xl overflow-y-auto border-teal-100 bg-[#f8fcfc] p-0 shadow-2xl" showCloseButton={false}>
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
          <DialogHeader className="relative max-w-3xl text-left">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-100">Your Learn access guide</p>
            <DialogTitle className="font-serif text-2xl leading-tight text-white sm:text-3xl">Your learning is ready when you are.</DialogTitle>
            <DialogDescription className="mt-2 max-w-2xl text-sm leading-6 text-teal-50">
              Follow the actual Learning Platform screens below. The dashboard and cohort previews display your own signed-in experience, not a generic example.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-4 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
            <nav aria-label="Guide steps" className="grid grid-cols-2 gap-2 lg:flex lg:flex-col">
              {previews.map((preview) => {
                const Icon = preview.icon;
                const selected = currentPreview.id === preview.id;
                return (
                  <button
                    key={preview.id}
                    type="button"
                    onClick={() => setActivePreview(preview.id)}
                    className={`rounded-xl border p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${selected ? "border-teal-300 bg-teal-50 shadow-sm" : "border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50/50"}`}
                  >
                    <span className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${selected ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"}`}><Icon className="h-4 w-4" /></span>
                    <span className={`block text-[10px] font-bold uppercase tracking-[0.12em] ${selected ? "text-teal-700" : "text-slate-400"}`}>{preview.label}</span>
                    <span className="mt-0.5 block text-xs font-bold leading-5 text-slate-800">{preview.id === "content" ? "Access your learning" : preview.id === "billing" ? "Manage your plan" : preview.id === "cohort" ? "Enter My Cohort" : "Click top-right, then My Dashboard"}</span>
                  </button>
                );
              })}
            </nav>

            <section className="min-w-0">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-teal-700">{currentPreview.label}</p>
                  <h3 className="mt-1 text-base font-bold text-slate-900 sm:text-lg">{currentPreview.title}</h3>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">{currentPreview.description}</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="shrink-0 border-teal-300 bg-white text-teal-800 hover:bg-teal-50" onClick={() => goTo(currentPreview.href)}>
                  Open this area <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex h-7 items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3">
                  <span className="h-2 w-2 rounded-full bg-rose-300" />
                  <span className="h-2 w-2 rounded-full bg-amber-300" />
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  <span className="ml-2 truncate text-[10px] font-medium text-slate-400">Learning Platform — your signed-in view</span>
                </div>
                <div className="h-[300px] bg-[#f0fbfc] sm:h-[380px]">
                  <iframe
                    key={currentPreview.id}
                    title={`${currentPreview.title} preview`}
                    src={previewUrl(currentPreview.href, currentPreview.id === "account")}
                    className="h-full w-full border-0 bg-white"
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">The preview is safe to close at any time. Choose <strong>Open this area</strong> to continue in the full Learning Platform.</p>
            </section>
          </div>

          <div className="mt-5 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
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
