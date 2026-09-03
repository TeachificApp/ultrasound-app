import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, FolderTree, Image, Mail, ShieldCheck, Users, WandSparkles } from "lucide-react";
import { useLocation } from "wouter";

const managerTools = [
  { title: "Course & Content Management", description: "Create and update courses, lessons, cohorts, workshops, and learner content.", href: "/admin/lms", icon: BookOpen },
  { title: "Question Bank", description: "Manage folders, questions, imports, and assignments for native assessments.", href: "/question-bank", icon: FolderTree },
  { title: "Quiz Builder", description: "Create and update standalone quizzes, lesson quizzes, and mock exams.", href: "/admin/quiz-creator", icon: WandSparkles },
  { title: "Media Repository", description: "Upload and update media used throughout course and content experiences.", href: "/admin/media-repository", icon: Image },
  { title: "Email Campaigns", description: "Create campaigns and review open, click, unsubscribe, and link engagement data.", href: "/admin/email-campaigns", icon: Mail },
  { title: "Members & Access", description: "Manage students, enrollments, access, certificates, invitations, and subscriptions without payment details.", href: "/admin/members?tab=all-members", icon: Users },
];

export default function PlatformManagerDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">Platform Manager</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">Welcome{user?.name ? `, ${user.name}` : ""}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Manage platform content, learners, subscriptions, and campaigns. Financial totals, payment amounts, prices, revenue reporting, refunds, payment creation, and deletion actions are intentionally unavailable.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Management workspace</h2>
            <p className="mt-1 text-sm text-slate-500">Choose an approved area to continue.</p>
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">Limited administrative access</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {managerTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card key={tool.href} className="border-slate-200 shadow-sm transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Icon className="h-5 w-5" /></div>
                  <CardTitle className="text-base">{tool.title}</CardTitle>
                  <CardDescription className="min-h-10 text-sm leading-5">{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full border-teal-200 text-teal-800 hover:bg-teal-50" onClick={() => navigate(tool.href)}>
                    Open workspace
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </main>
  );
}
