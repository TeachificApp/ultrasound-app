/*
 * StudentDashboard.tsx — Student Member Portal for EducatorAssist
 *
 * Accessible to: education_student, education_admin, education_manager, platform_admin
 *
 * Tabs:
 *   My Assignments  — pending/completed assignments with due dates
 *   My Courses      — enrolled courses and module progress
 *   Competencies    — personal competency levels and progress
 *   Leaderboard     — class ranking and scores
 */

import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  GraduationCap, ClipboardList, BookOpen, Award, BarChart3,
  Loader2, CheckCircle2, Clock, AlertCircle, ArrowRight, Lock,
  Star, TrendingUp, Users, Calendar, ChevronRight
} from "lucide-react";
import { Link } from "wouter";

const BRAND = "#189aa1";

// ─── Role gate ───────────────────────────────────────────────────────────────

function StudentRoleGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" />
    </div>
  );
  const allowed = user?.appRoles?.some(r =>
    ["education_student", "education_admin", "education_manager", "platform_admin"].includes(r)
  );
  if (!allowed) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
          style={{ background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}>
          <Lock className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "Merriweather, serif" }}>
          Student Access Required
        </h2>
        <p className="text-sm text-muted-foreground">
          You need a Student Member role to access this portal. Contact your educator to request enrollment.
        </p>
        <Link href="/">
          <Button variant="outline" className="gap-2">
            <ArrowRight className="w-4 h-4" />Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
  return <>{children}</>;
}

// ─── Assignments Tab ──────────────────────────────────────────────────────────

function AssignmentsTab({ orgId }: { orgId: number }) {
  const { data: assignments, isLoading } = trpc.educator.getStudentAssignmentProgress.useQuery({ orgId });
  const utils = trpc.useUtils();

  const submitAttempt = trpc.educator.submitQuizAttempt.useMutation({
    onSuccess: () => {
      toast.success("Assignment submitted!");
      utils.educator.getStudentAssignmentProgress.invalidate({ orgId });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" />
    </div>
  );

  const pending = assignments?.filter(a => a.myStatus === "not_started" || a.myStatus === "in_progress") ?? [];
  const completed = assignments?.filter(a => a.myStatus === "completed" || a.myStatus === "failed") ?? [];

  const statusBadge = (status: string) => {
    switch (status) {
      case "passed": return <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Passed</Badge>;
      case "failed": return <Badge className="text-xs bg-red-100 text-red-700 border-red-200">Failed</Badge>;
      case "completed": return <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200">Completed</Badge>;
      case "in_progress": return <Badge className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200">In Progress</Badge>;
      default: return <Badge className="text-xs bg-gray-100 text-gray-600 border-gray-200">Assigned</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Pending */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
          <Clock className="w-4 h-4 text-yellow-500" />
          Pending Assignments ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-medium">All caught up!</p>
            <p className="text-xs text-gray-400 mt-1">No pending assignments right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((a) => (
              <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:border-[#189aa1]/20 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {statusBadge(a.myStatus)}
                      {a.dueAt && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Due {new Date(a.dueAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-gray-800 text-sm" style={{ fontFamily: "Merriweather, serif" }}>
                      {a.title}
                    </h4>
                    {a.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.description}</p>
                    )}
                    {a.passingScore && (
                      <p className="text-xs text-gray-400 mt-1">Passing score: {a.passingScore}%</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    style={{ background: BRAND }}
                    className="text-white flex-shrink-0 gap-1"
                    onClick={() => {
                      // In a real implementation this would open the assignment content
                      toast.success("Opening assignment...");
                    }}
                  >
                    Start <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Completed ({completed.length})
          </h3>
          <div className="space-y-2">
            {completed.map((a) => (
              <div key={a.id} className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {statusBadge(a.myStatus)}
                      {a.myScore !== null && a.myScore !== undefined && (
                        <span className="text-xs font-semibold" style={{ color: BRAND }}>
                          Score: {a.myScore}%
                        </span>
                      )}
                    </div>
                    <h4 className="font-medium text-gray-700 text-sm">{a.title}</h4>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Courses Tab ──────────────────────────────────────────────────────────────

function CoursesTab({ orgId }: { orgId: number }) {
  const { data: courses, isLoading } = trpc.educator.getCourses.useQuery({ orgId });
  const { data: progress } = trpc.educator.getStudentProgress.useQuery({ orgId });

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" />
    </div>
  );

  if (!courses || courses.length === 0) return (
    <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
      <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 text-sm font-medium">No courses yet</p>
      <p className="text-gray-400 text-xs mt-1">Your educator hasn't published any courses yet.</p>
    </div>
  );

  // Build a progress map by courseId
  const progressMap = new Map<number, typeof progress extends (infer T)[] | undefined ? T : never>();
  progress?.forEach(p => {
    if (p.courseId) progressMap.set(p.courseId, p as any);
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {courses.filter(c => c.status === "published").map((course) => {
        const prog = progressMap.get(course.id);
        const pct = prog ? Math.round(((prog as any).completedModules / Math.max((prog as any).totalModules ?? 1, 1)) * 100) : 0;
        return (
          <div key={course.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:border-[#189aa1]/20 transition-all">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: BRAND + "15" }}>
                <BookOpen className="w-5 h-5" style={{ color: BRAND }} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-800 text-sm leading-snug" style={{ fontFamily: "Merriweather, serif" }}>
                  {course.title}
                </h4>
                {course.category && (
                  <Badge variant="outline" className="text-xs mt-1" style={{ borderColor: BRAND + "40", color: BRAND }}>
                    {course.category}
                  </Badge>
                )}
              </div>
            </div>
            {course.description && (
              <p className="text-xs text-gray-500 mb-3 line-clamp-2">{course.description}</p>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Progress</span>
                <span className="font-semibold" style={{ color: BRAND }}>{pct}%</span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Competencies Tab ─────────────────────────────────────────────────────────

function CompetenciesTab({ orgId }: { orgId: number }) {
  const { data: competencies, isLoading } = trpc.educator.getCompetencies.useQuery({ orgId });

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" />
    </div>
  );

  if (!competencies || competencies.length === 0) return (
    <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
      <Award className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 text-sm font-medium">No competencies defined yet</p>
      <p className="text-gray-400 text-xs mt-1">Your educator will add competency requirements soon.</p>
    </div>
  );

  const levelColors = ["bg-gray-200", "bg-blue-200", "bg-teal-200", "bg-green-200", "bg-yellow-200"];

  return (
    <div className="space-y-3">
      {competencies.map((comp) => {
        const currentLevel = 0; // In a real implementation, fetch from student progress
        const pct = Math.round((currentLevel / Math.max(comp.maxLevel ?? 5, 1)) * 100);
        return (
          <div key={comp.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: BRAND + "15" }}>
                <Award className="w-4 h-4" style={{ color: BRAND }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-gray-800 text-sm" style={{ fontFamily: "Merriweather, serif" }}>
                    {comp.title}
                  </h4>
                  <span className="text-xs font-semibold" style={{ color: BRAND }}>
                    Level {currentLevel}/{comp.maxLevel ?? 5}
                  </span>
                </div>
                {comp.description && (
                  <p className="text-xs text-gray-500 mb-2 line-clamp-1">{comp.description}</p>
                )}
                <div className="flex items-center gap-2">
                  <Progress value={pct} className="h-1.5 flex-1" />
                  <div className="flex gap-0.5">
                    {Array.from({ length: comp.maxLevel ?? 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-sm ${i < currentLevel ? levelColors[Math.min(i, levelColors.length - 1)] : "bg-gray-100"}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Leaderboard Tab ──────────────────────────────────────────────────────────

function LeaderboardTab({ orgId }: { orgId: number }) {
  const { data: leaderboard, isLoading } = trpc.educator.getLeaderboard.useQuery({ orgId });
  const { user } = useAuth();

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" />
    </div>
  );

  if (!leaderboard || leaderboard.length === 0) return (
    <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
      <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 text-sm font-medium">No leaderboard data yet</p>
      <p className="text-gray-400 text-xs mt-1">Complete assignments to appear on the leaderboard.</p>
    </div>
  );

  const medalColors = ["text-yellow-500", "text-gray-400", "text-amber-600"];

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2" style={{ fontFamily: "Merriweather, serif" }}>
          <Users className="w-4 h-4" style={{ color: BRAND }} />
          Class Leaderboard
        </h4>
        <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND + "40", color: BRAND }}>
          {leaderboard.length} students
        </Badge>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">#</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Completed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {leaderboard.map((entry, idx) => {
            const isMe = entry.userId === user?.id;
            return (
              <tr key={entry.userId}
                className={`hover:bg-gray-50/50 transition-colors ${isMe ? "bg-[#189aa1]/5" : ""}`}>
                <td className="px-4 py-3">
                  {idx < 3 ? (
                    <Star className={`w-4 h-4 ${medalColors[idx]}`} fill="currentColor" />
                  ) : (
                    <span className="text-xs text-gray-400 font-mono">{idx + 1}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: isMe ? BRAND : "#94a3b8" }}>
                      {(entry.name ?? "?")[0]?.toUpperCase()}
                    </div>
                    <span className={`text-sm font-medium ${isMe ? "text-[#189aa1]" : "text-gray-800"}`}>
                      {entry.name ?? "Student"}{isMe && " (You)"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-bold" style={{ color: BRAND }}>{entry.avgScore ?? 0}%</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs text-gray-600">{entry.completedAssignments ?? 0}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main StudentDashboard ────────────────────────────────────────────────────

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data: orgs, isLoading: orgsLoading } = trpc.educator.getMyOrgs.useQuery();
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);

  // Auto-select first org
  const orgId = selectedOrgId ?? orgs?.[0]?.id ?? null;

  if (orgsLoading) return (
    <Layout>
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" />
      </div>
    </Layout>
  );

  if (!orgId) return (
    <Layout>
      <div className="container py-12 max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
          style={{ background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}>
          <GraduationCap className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "Merriweather, serif" }}>
          Not Enrolled Yet
        </h2>
        <p className="text-sm text-muted-foreground">
          You haven't been enrolled in any EducatorAssist programs yet. Ask your educator to send you an invitation.
        </p>
        <Link href="/educator-assist">
          <Button style={{ background: BRAND }} className="text-white gap-2">
            <GraduationCap className="w-4 h-4" />
            Learn About EducatorAssist
          </Button>
        </Link>
      </div>
    </Layout>
  );

  return (
    <StudentRoleGate>
      <Layout>
        {/* Header */}
        <div className="relative overflow-hidden border-b border-gray-100"
          style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}>
          <div className="container py-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.15)" }}>
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>
                  My Learning Portal
                </h1>
                <p className="text-sm text-white/70 mt-0.5">
                  {orgs?.find(o => o.id === orgId)?.name ?? "EducatorAssist"}
                </p>
              </div>
            </div>

            {/* Org selector if multiple orgs */}
            {orgs && orgs.length > 1 && (
              <div className="flex gap-2 mt-4 flex-wrap">
                {orgs.map(org => (
                  <button
                    key={org.id}
                    onClick={() => setSelectedOrgId(org.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      org.id === orgId
                        ? "bg-white text-[#189aa1]"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {org.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="container py-6">
          <Tabs defaultValue="assignments">
            <TabsList className="mb-6 bg-gray-100 p-1 rounded-xl h-auto flex-wrap gap-1">
              <TabsTrigger value="assignments" className="gap-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <ClipboardList className="w-3.5 h-3.5" />
                Assignments
              </TabsTrigger>
              <TabsTrigger value="courses" className="gap-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <BookOpen className="w-3.5 h-3.5" />
                Courses
              </TabsTrigger>
              <TabsTrigger value="competencies" className="gap-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Award className="w-3.5 h-3.5" />
                Competencies
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="gap-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <BarChart3 className="w-3.5 h-3.5" />
                Leaderboard
              </TabsTrigger>
            </TabsList>

            <TabsContent value="assignments">
              <AssignmentsTab orgId={orgId} />
            </TabsContent>
            <TabsContent value="courses">
              <CoursesTab orgId={orgId} />
            </TabsContent>
            <TabsContent value="competencies">
              <CompetenciesTab orgId={orgId} />
            </TabsContent>
            <TabsContent value="leaderboard">
              <LeaderboardTab orgId={orgId} />
            </TabsContent>
          </Tabs>
        </div>
      </Layout>
    </StudentRoleGate>
  );
}
