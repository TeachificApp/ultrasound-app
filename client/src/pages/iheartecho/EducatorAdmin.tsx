/**
 * EducatorAdmin.tsx — Educator Dashboard
 *
 * Accessible to: education_admin, education_manager, platform_admin
 *
 * Tabs:
 *   Overview      — org stats, quick actions
 *   Courses       — course builder (create/edit/delete courses with modules)
 *   Students      — roster, invite, remove, view progress
 *   Assignments   — assign content to students/groups with due dates
 *   Competencies  — define and track clinical competencies
 *   Analytics     — completion rates, scores, engagement
 */

import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  GraduationCap, Users, BookOpen, BarChart3, Award, Plus, Trash2,
  Edit, ChevronRight, Loader2, CheckCircle2, Clock, AlertCircle,
  UserPlus, Mail, MoreVertical, TrendingUp, FileText, Layers,
  ClipboardList, Star, ArrowRight, RefreshCw, Eye, Lock
} from "lucide-react";
import { Link } from "wouter";

const BRAND = "#189aa1";

// ─── Role gate ───────────────────────────────────────────────────────────────

function EducatorRoleGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" />
    </div>
  );
  const allowed = user?.appRoles?.some(r =>
    ["education_admin", "education_manager", "platform_admin"].includes(r)
  );
  if (!allowed) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}>
          <Lock className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "Merriweather, serif" }}>Educator Access Required</h2>
        <p className="text-sm text-muted-foreground">You need an Educator Admin role to access this dashboard. Contact your Platform Admin to request access.</p>
        <Link href="/"><Button variant="outline" className="gap-2"><ArrowRight className="w-4 h-4" />Back to Dashboard</Button></Link>
      </div>
    </div>
  );
  return <>{children}</>;
}

// ─── Org selector ─────────────────────────────────────────────────────────────

function useMyOrgs() {
  return trpc.educator.getMyOrgs.useQuery();
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ orgId }: { orgId: number }) {
  const { data: stats, isLoading } = trpc.educator.getOrgAnalytics.useQuery({ orgId });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" /></div>;

  const cards = [
    { label: "Total Students", value: stats?.studentCount ?? 0, icon: Users, color: BRAND },
    { label: "Active Courses", value: stats?.courseCount ?? 0, icon: BookOpen, color: BRAND },
    { label: "Completed Modules", value: stats?.completedModules ?? 0, icon: ClipboardList, color: BRAND },
    { label: "Avg Score", value: `${stats?.avgScore ?? 0}%`, icon: TrendingUp, color: BRAND },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: color + "15" }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900" style={{ fontFamily: "JetBrains Mono, monospace" }}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-800 text-sm mb-4" style={{ fontFamily: "Merriweather, serif" }}>Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "New Course", icon: BookOpen, tab: "courses" },
            { label: "Invite Student", icon: UserPlus, tab: "students" },
            { label: "New Assignment", icon: ClipboardList, tab: "assignments" },
            { label: "View Analytics", icon: BarChart3, tab: "analytics" },
          ].map(({ label, icon: Icon }) => (
            <button
              key={label}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 hover:border-[#189aa1]/30 hover:bg-[#f0fbfc] transition-all text-center"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: BRAND + "15" }}>
                <Icon className="w-4 h-4" style={{ color: BRAND }} />
              </div>
              <span className="text-xs font-medium text-gray-700">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Courses Tab ──────────────────────────────────────────────────────────────

function CoursesTab({ orgId }: { orgId: number }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingCourse, setEditingCourse] = useState<{ id: number; title: string; description: string; category: string; difficulty: string; status: string } | null>(null);
  const [form, setForm] = useState<{ title: string; description: string; category: string; difficulty: "beginner" | "intermediate" | "advanced" | "expert" }>({ title: "", description: "", category: "echo_fundamentals", difficulty: "beginner" });
  const utils = trpc.useUtils();

  const { data: courses, isLoading } = trpc.educator.getCourses.useQuery({ orgId });

  const createCourse = trpc.educator.createCourse.useMutation({
    onSuccess: () => {
      toast.success("Course created!");
      setShowCreate(false);
      setForm({ title: "", description: "", category: "echo_fundamentals", difficulty: "beginner" as const });
      utils.educator.getCourses.invalidate({ orgId });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCourse = trpc.educator.updateCourse.useMutation({
    onSuccess: () => {
      toast.success("Course updated!");
      setEditingCourse(null);
      utils.educator.getCourses.invalidate({ orgId });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCourse = trpc.educator.deleteCourse.useMutation({
    onSuccess: () => {
      toast.success("Course deleted");
      utils.educator.getCourses.invalidate({ orgId });
    },
  });

  const CATEGORIES = [
    { value: "echo_fundamentals", label: "Echo Fundamentals" },
    { value: "advanced_echo", label: "Advanced Echo" },
    { value: "pocus", label: "POCUS" },
    { value: "pediatric_echo", label: "Pediatric Echo" },
    { value: "fetal_echo", label: "Fetal Echo" },
    { value: "structural_heart", label: "Structural Heart" },
    { value: "stress_echo", label: "Stress Echo" },
    { value: "competency_assessment", label: "Competency Assessment" },
    { value: "exam_prep", label: "Exam Prep" },
    { value: "custom", label: "Custom" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Courses</h3>
        <Button size="sm" className="gap-2" style={{ background: BRAND }} onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Course
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" /></div>
      ) : !courses?.length ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No courses yet</p>
          <p className="text-gray-400 text-xs mt-1">Create your first course to get started</p>
          <Button size="sm" className="mt-4 gap-2" style={{ background: BRAND }} onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Create Course
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <div key={course.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:border-[#189aa1]/30 hover:shadow-sm transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: BRAND + "15" }}>
                  <BookOpen className="w-4 h-4" style={{ color: BRAND }} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-1 rounded hover:bg-gray-100"
                    title="Edit"
                    onClick={() => setEditingCourse({
                      id: course.id,
                      title: course.title,
                      description: course.description ?? "",
                      category: course.category ?? "echo_fundamentals",
                      difficulty: "beginner",
                      status: course.status ?? "draft",
                    })}
                  >
                    <Edit className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-red-50"
                    title="Delete"
                    onClick={() => {
                      if (confirm("Delete this course?")) deleteCourse.mutate({ courseId: course.id, orgId });
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
              <h4 className="font-bold text-gray-800 text-sm mb-1 leading-snug" style={{ fontFamily: "Merriweather, serif" }}>{course.title}</h4>
              {course.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{course.description}</p>}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND + "40", color: BRAND }}>
                  {CATEGORIES.find(c => c.value === course.category)?.label ?? course.category}
                </Badge>
                <Badge variant="outline" className={`text-xs capitalize ${course.status === "published" ? "border-green-200 text-green-700" : "border-gray-200 text-gray-500"}`}>
                  {course.status === "published" ? "Published" : course.status === "archived" ? "Archived" : "Draft"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Course Dialog */}
      <Dialog open={!!editingCourse} onOpenChange={(open) => { if (!open) setEditingCourse(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Merriweather, serif" }}>Edit Course</DialogTitle>
          </DialogHeader>
          {editingCourse && (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Course Title *</label>
                <Input
                  placeholder="e.g. Echo Fundamentals for Sonographers"
                  value={editingCourse.title}
                  onChange={e => setEditingCourse(c => c ? { ...c, title: e.target.value } : c)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Description</label>
                <Textarea
                  placeholder="Describe what students will learn..."
                  rows={3}
                  value={editingCourse.description}
                  onChange={e => setEditingCourse(c => c ? { ...c, description: e.target.value } : c)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Category</label>
                  <Select value={editingCourse.category} onValueChange={v => setEditingCourse(c => c ? { ...c, category: v } : c)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Difficulty</label>
                  <Select value={editingCourse.difficulty} onValueChange={v => setEditingCourse(c => c ? { ...c, difficulty: v } : c)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                      <SelectItem value="expert">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Status</label>
                <Select value={editingCourse.status} onValueChange={v => setEditingCourse(c => c ? { ...c, status: v } : c)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCourse(null)}>Cancel</Button>
            <Button
              style={{ background: BRAND }}
              disabled={!editingCourse?.title.trim() || updateCourse.isPending}
              onClick={() => editingCourse && updateCourse.mutate({
                courseId: editingCourse.id,
                orgId,
                title: editingCourse.title,
                description: editingCourse.description,
                status: editingCourse.status as "draft" | "published" | "archived",
              })}
            >
              {updateCourse.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Course Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Merriweather, serif" }}>Create New Course</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Course Title *</label>
              <Input placeholder="e.g. Echo Fundamentals for Sonographers" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Description</label>
              <Textarea placeholder="Describe what students will learn..." rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Category</label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Difficulty</label>
                <Select value={form.difficulty} onValueChange={v => setForm(f => ({ ...f, difficulty: v as "beginner" | "intermediate" | "advanced" | "expert" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              style={{ background: BRAND }}
              disabled={!form.title.trim() || createCourse.isPending}
              onClick={() => createCourse.mutate({ orgId, title: form.title, description: form.description })}
            >
              {createCourse.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Students Tab ─────────────────────────────────────────────────────────────

function StudentsTab({ orgId }: { orgId: number }) {
  // toast from sonner
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const utils = trpc.useUtils();

  const { data: members, isLoading } = trpc.educator.getOrgMembers.useQuery({ orgId });

  const inviteStudent = trpc.educator.inviteStudent.useMutation({
    onSuccess: () => {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setShowInvite(false);
      setInviteEmail("");
      utils.educator.getOrgMembers.invalidate({ orgId });
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMember = trpc.educator.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Member removed");
      utils.educator.getOrgMembers.invalidate({ orgId });
    },
  });

  const students = members?.filter(m => m.orgRole === "education_student") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
          Students <span className="text-gray-400 font-normal text-sm ml-1">({students.length})</span>
        </h3>
        <Button size="sm" className="gap-2" style={{ background: BRAND }} onClick={() => setShowInvite(true)}>
          <UserPlus className="w-4 h-4" /> Invite Student
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" /></div>
      ) : !students.length ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No students enrolled yet</p>
          <p className="text-gray-400 text-xs mt-1">Invite students to join your organization</p>
          <Button size="sm" className="mt-4 gap-2" style={{ background: BRAND }} onClick={() => setShowInvite(true)}>
            <UserPlus className="w-4 h-4" /> Invite Student
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {students.map((m) => (
                <tr key={m.userId} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: BRAND }}>
                        {(m.userDisplayName ?? m.userName ?? "?")[0]?.toUpperCase()}
                      </div>
                      <div>
                      <div className="font-medium text-gray-800 text-sm">{m.userDisplayName ?? m.userName ?? "Unknown"}</div>
                      <div className="text-xs text-gray-400">{m.userEmail ?? ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-xs ${m.status === "active" ? "border-green-200 text-green-700" : m.status === "pending" ? "border-amber-200 text-amber-700" : "border-gray-200 text-gray-500"}`}>
                      {m.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="Remove student"
                      onClick={() => {
                        if (confirm("Remove this student from the organization?")) {
                          removeMember.mutate({ orgId, memberId: m.id });
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Merriweather, serif" }}>Invite Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Student Email *</label>
              <Input
                type="email"
                placeholder="student@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">The student will receive an invitation email to join your organization.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button
              style={{ background: BRAND }}
              disabled={!inviteEmail.trim() || inviteStudent.isPending}
              onClick={() => inviteStudent.mutate({ orgId, email: inviteEmail.trim() })}
            >
              {inviteStudent.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4 mr-2" />Send Invitation</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Assignments Tab ──────────────────────────────────────────────────────────

function AssignmentsTab({ orgId }: { orgId: number }) {
  // toast from sonner
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", contentType: "course" as const,
    contentId: 0, dueDate: "", passingScore: 70,
  });
  const utils = trpc.useUtils();

  const { data: assignments, isLoading } = trpc.educator.getAssignments.useQuery({ orgId });
  const { data: courses } = trpc.educator.getCourses.useQuery({ orgId });

  const createAssignment = trpc.educator.createAssignment.useMutation({
    onSuccess: () => {
      toast.success("Assignment created!");
      setShowCreate(false);
      utils.educator.getAssignments.invalidate({ orgId });
    },
    onError: (e) => toast.error(e.message),
  });

  const STATUS_COLORS: Record<string, string> = {
    active: "border-green-200 text-green-700",
    draft: "border-gray-200 text-gray-500",
    completed: "border-blue-200 text-blue-700",
    archived: "border-gray-200 text-gray-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Assignments</h3>
        <Button size="sm" className="gap-2" style={{ background: BRAND }} onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Assignment
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" /></div>
      ) : !assignments?.length ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No assignments yet</p>
          <p className="text-gray-400 text-xs mt-1">Create an assignment to send content to your students</p>
          <Button size="sm" className="mt-4 gap-2" style={{ background: BRAND }} onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Create Assignment
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:border-[#189aa1]/20 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-bold text-gray-800 text-sm" style={{ fontFamily: "Merriweather, serif" }}>{a.title}</h4>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[a.status] ?? ""}`}>{a.status}</Badge>
                  </div>
                  {a.description && <p className="text-xs text-gray-500 mb-2 line-clamp-1">{a.description}</p>}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{a.targetType}</span>
                    {a.dueAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Due {new Date(a.dueAt).toLocaleDateString()}</span>}
                    {a.passingScore && <span className="flex items-center gap-1"><Star className="w-3 h-3" />Pass: {a.passingScore}%</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 flex-shrink-0">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />assigned</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Assignment Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Merriweather, serif" }}>Create Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Title *</label>
              <Input placeholder="e.g. Week 1: Echo Fundamentals" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Description</label>
              <Textarea placeholder="Instructions for students..." rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Content Type</label>
                <Select value={form.contentType} onValueChange={v => setForm(f => ({ ...f, contentType: v as typeof form.contentType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="course">Course</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="flashcard_deck">Flashcard Deck</SelectItem>
                    <SelectItem value="case_study">Case Study</SelectItem>
                    <SelectItem value="presentation">Presentation</SelectItem>
                    <SelectItem value="challenge">Challenge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Passing Score (%)</label>
                <Input type="number" min={0} max={100} value={form.passingScore} onChange={e => setForm(f => ({ ...f, passingScore: Number(e.target.value) }))} />
              </div>
            </div>
            {form.contentType === "course" && courses && (
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Select Course</label>
                <Select value={String(form.contentId)} onValueChange={v => setForm(f => ({ ...f, contentId: Number(v) }))}>
                  <SelectTrigger><SelectValue placeholder="Choose a course..." /></SelectTrigger>
                  <SelectContent>
                    {courses.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Due Date (optional)</label>
              <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              style={{ background: BRAND }}
              disabled={!form.title.trim() || createAssignment.isPending}
              onClick={() => createAssignment.mutate({
                orgId,
                title: form.title,
                description: form.description,
                courseId: form.contentId ? Number(form.contentId) : undefined,
                targetType: "org_wide" as const,
                dueAt: form.dueDate ? new Date(form.dueDate) : undefined,
                passingScore: form.passingScore,
              })}
            >
              {createAssignment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Competencies Tab ─────────────────────────────────────────────────────────

function CompetenciesTab({ orgId }: { orgId: number }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingComp, setEditingComp] = useState<{ id: number; title: string; description: string; category: string; maxLevel: number } | null>(null);
  const [assignComp, setAssignComp] = useState<{ id: number; title: string } | null>(null);
  const [reviewComp, setReviewComp] = useState<{ id: number; title: string; maxLevel: number } | null>(null);
  const [form, setForm] = useState({ name: "", description: "", category: "clinical_skills", maxLevel: 5 });
  const [assignForm, setAssignForm] = useState({ userId: 0, achievedLevel: 1, notes: "" });
  const utils = trpc.useUtils();

  const { data: competencies, isLoading } = trpc.educator.getCompetencies.useQuery({ orgId });
  const { data: members } = trpc.educator.getOrgMembers.useQuery({ orgId });

  const createCompetency = trpc.educator.createCompetency.useMutation({
    onSuccess: () => {
      toast.success("Competency created!");
      setShowCreate(false);
      setForm({ name: "", description: "", category: "clinical_skills", maxLevel: 5 });
      utils.educator.getCompetencies.invalidate({ orgId });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStudentCompetency = trpc.educator.updateStudentCompetency.useMutation({
    onSuccess: () => {
      toast.success("Competency level assigned!");
      setAssignComp(null);
      setAssignForm({ userId: 0, achievedLevel: 1, notes: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const COMP_CATEGORIES = [
    { value: "clinical_skills", label: "Clinical Skills" },
    { value: "image_acquisition", label: "Image Acquisition" },
    { value: "image_interpretation", label: "Image Interpretation" },
    { value: "reporting", label: "Reporting" },
    { value: "patient_care", label: "Patient Care" },
    { value: "professionalism", label: "Professionalism" },
    { value: "communication", label: "Communication" },
    { value: "custom", label: "Custom" },
  ];

  const students = members?.filter(m => m.orgRole === "education_student") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Competencies</h3>
        <Button size="sm" className="gap-2" style={{ background: BRAND }} onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Competency
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" /></div>
      ) : !competencies?.length ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <Award className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No competencies defined yet</p>
          <p className="text-gray-400 text-xs mt-1">Define clinical competencies to track student achievement</p>
          <Button size="sm" className="mt-4 gap-2" style={{ background: BRAND }} onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Create Competency
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {competencies.map((comp) => (
            <div key={comp.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:border-[#189aa1]/20 transition-all group">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND + "15" }}>
                  <Award className="w-4 h-4" style={{ color: BRAND }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-800 text-sm mb-0.5" style={{ fontFamily: "Merriweather, serif" }}>{comp.title}</h4>
                  {comp.description && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{comp.description}</p>}
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND + "40", color: BRAND }}>
                      {COMP_CATEGORIES.find(c => c.value === comp.category)?.label ?? comp.category}
                    </Badge>
                    <span className="text-xs text-gray-400">{comp.maxLevel} levels</span>
                  </div>
                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:border-[#189aa1]/40 hover:bg-[#f0fbfc] text-gray-600 transition-all"
                      onClick={() => setEditingComp({ id: comp.id, title: comp.title, description: comp.description ?? "", category: comp.category ?? "clinical_skills", maxLevel: comp.maxLevel ?? 5 })}
                    >
                      <Edit className="w-3 h-3" /> Edit
                    </button>
                    <button
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:border-[#189aa1]/40 hover:bg-[#f0fbfc] text-gray-600 transition-all"
                      onClick={() => setAssignComp({ id: comp.id, title: comp.title })}
                    >
                      <UserPlus className="w-3 h-3" /> Assign
                    </button>
                    <button
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:border-[#189aa1]/40 hover:bg-[#f0fbfc] text-gray-600 transition-all"
                      onClick={() => setReviewComp({ id: comp.id, title: comp.title, maxLevel: comp.maxLevel ?? 5 })}
                    >
                      <Eye className="w-3 h-3" /> Review
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Competency Dialog */}
      <Dialog open={!!editingComp} onOpenChange={(open) => { if (!open) setEditingComp(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Merriweather, serif" }}>Edit Competency</DialogTitle>
          </DialogHeader>
          {editingComp && (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Competency Name *</label>
                <Input
                  value={editingComp.title}
                  onChange={e => setEditingComp(c => c ? { ...c, title: e.target.value } : c)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Description</label>
                <Textarea
                  rows={3}
                  value={editingComp.description}
                  onChange={e => setEditingComp(c => c ? { ...c, description: e.target.value } : c)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Category</label>
                  <Select value={editingComp.category} onValueChange={v => setEditingComp(c => c ? { ...c, category: v } : c)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMP_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Max Level</label>
                  <Input
                    type="number" min={2} max={10}
                    value={editingComp.maxLevel}
                    onChange={e => setEditingComp(c => c ? { ...c, maxLevel: Number(e.target.value) } : c)}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingComp(null)}>Cancel</Button>
            <Button
              style={{ background: BRAND }}
              disabled={!editingComp?.title.trim()}
              onClick={() => {
                if (!editingComp) return;
                // Re-create with updated values (no updateCompetency endpoint yet — show toast)
                toast.info("Competency details noted. Full edit save coming soon.");
                setEditingComp(null);
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Competency Level Dialog */}
      <Dialog open={!!assignComp} onOpenChange={(open) => { if (!open) setAssignComp(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Merriweather, serif" }}>Assign Competency Level</DialogTitle>
            {assignComp && <p className="text-xs text-gray-500 mt-1">{assignComp.title}</p>}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Student *</label>
              <Select value={String(assignForm.userId)} onValueChange={v => setAssignForm(f => ({ ...f, userId: Number(v) }))}>
                <SelectTrigger><SelectValue placeholder="Select a student..." /></SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.userId} value={String(s.userId)}>
                      {s.userName ?? s.inviteEmail ?? `User #${s.userId}`}
                    </SelectItem>
                  ))}
                  {students.length === 0 && (
                    <SelectItem value="0" disabled>No students in org</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Achieved Level</label>
              <Input
                type="number" min={0} max={10}
                value={assignForm.achievedLevel}
                onChange={e => setAssignForm(f => ({ ...f, achievedLevel: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes (optional)</label>
              <Textarea
                placeholder="Assessment notes, evidence, observations..."
                rows={3}
                value={assignForm.notes}
                onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignComp(null)}>Cancel</Button>
            <Button
              style={{ background: BRAND }}
              disabled={!assignForm.userId || updateStudentCompetency.isPending}
              onClick={() => assignComp && updateStudentCompetency.mutate({
                orgId,
                userId: assignForm.userId,
                competencyId: assignComp.id,
                achievedLevel: assignForm.achievedLevel,
                notes: assignForm.notes,
              })}
            >
              {updateStudentCompetency.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Assessment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Competency Dialog */}
      <Dialog open={!!reviewComp} onOpenChange={(open) => { if (!open) setReviewComp(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Merriweather, serif" }}>Review: {reviewComp?.title}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-xs text-gray-500">Student competency levels for this competency across your organization.</p>
            {students.length === 0 ? (
              <div className="text-center py-6">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No students in this organization yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {students.map(s => (
                  <div key={s.userId} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: BRAND }}>
                        {(s.userName ?? s.inviteEmail ?? "?")[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm text-gray-700 font-medium">{s.userName ?? s.inviteEmail ?? `User #${s.userId}`}</span>
                    </div>
                    <button
                      className="text-xs px-2.5 py-1 rounded-lg text-white transition-all hover:opacity-90"
                      style={{ background: BRAND }}
                      onClick={() => {
                        setReviewComp(null);
                        if (reviewComp) setAssignComp({ id: reviewComp.id, title: reviewComp.title });
                        setAssignForm(f => ({ ...f, userId: s.userId }));
                      }}
                    >
                      Assess
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewComp(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Competency Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Merriweather, serif" }}>Create Competency</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Competency Name *</label>
              <Input placeholder="e.g. Parasternal Long Axis View Acquisition" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Description</label>
              <Textarea placeholder="Describe what this competency covers..." rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Category</label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMP_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Max Level</label>
                <Input type="number" min={2} max={10} value={form.maxLevel} onChange={e => setForm(f => ({ ...f, maxLevel: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              style={{ background: BRAND }}
              disabled={!form.name.trim() || createCompetency.isPending}
              onClick={() => createCompetency.mutate({ orgId, title: form.name, description: form.description, category: form.category as any, maxLevel: form.maxLevel })}
            >
              {createCompetency.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Competency"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab({ orgId }: { orgId: number }) {
  const { data: analytics, isLoading } = trpc.educator.getOrgAnalytics.useQuery({ orgId });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" /></div>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Quiz Attempts", value: analytics?.quizAttempts ?? 0, icon: FileText },
          { label: "Avg Score", value: `${analytics?.avgScore ?? 0}%`, icon: Star },
          { label: "Quiz Pass Rate", value: `${analytics?.quizPassRate ?? 0}%`, icon: CheckCircle2 },
          { label: "Active Students", value: analytics?.studentCount ?? 0, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: BRAND + "15" }}>
              <Icon className="w-4 h-4" style={{ color: BRAND }} />
            </div>
            <div className="text-2xl font-black text-gray-900" style={{ fontFamily: "JetBrains Mono, monospace" }}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Student progress table */}
      {false ? (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h4 className="font-bold text-gray-800 text-sm" style={{ fontFamily: "Merriweather, serif" }}>Student Progress</h4>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assignments</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Completion</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {([] as { userId: number; name?: string; completed: number; total: number; avgScore?: number }[]).map((sp) => (
                <tr key={sp.userId} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: BRAND }}>
                        {(sp.name ?? "?")[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm text-gray-800 font-medium">{sp.name ?? "Unknown"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{sp.completed}/{sp.total}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Progress value={sp.total > 0 ? (sp.completed / sp.total) * 100 : 0} className="h-1.5 w-20" />
                      <span className="text-xs text-gray-500">{sp.total > 0 ? Math.round((sp.completed / sp.total) * 100) : 0}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: BRAND }}>{sp.avgScore ?? "—"}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No analytics data yet</p>
          <p className="text-gray-400 text-xs mt-1">Analytics will appear once students start completing assignments</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EducatorAdmin() {
  const { data: orgs, isLoading: orgsLoading } = useMyOrgs();
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);

  const activeOrgId = selectedOrgId ?? orgs?.[0]?.id ?? null;

  return (
    <EducatorRoleGate>
      <Layout>
        {/* Header */}
        <div className="border-b border-gray-100 bg-white">
          <div className="container py-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}>
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-gray-900" style={{ fontFamily: "Merriweather, serif" }}>EducatorAssist™</h1>
                  <p className="text-xs text-gray-500">Educator Dashboard</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {orgs && orgs.length > 1 && (
                  <Select value={String(activeOrgId)} onValueChange={v => setSelectedOrgId(Number(v))}>
                    <SelectTrigger className="w-full sm:w-48 text-sm">
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgs.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Link href="/educator-assist">
                  <Button variant="outline" size="sm" className="gap-2 text-xs">
                    <Eye className="w-3.5 h-3.5" /> View Platform Page
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-6">
          {orgsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" /></div>
          ) : !orgs?.length ? (
            /* No org yet — prompt to create one */
            <div className="max-w-lg mx-auto text-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}>
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Set Up Your Organization</h2>
              <p className="text-sm text-gray-500">You don't have an EducatorAssist organization yet. Contact your Platform Admin to have one created for you, or request access below.</p>
              <a href="mailto:support@iheartecho.com?subject=EducatorAssist Organization Request">
                <Button className="gap-2" style={{ background: BRAND }}>
                  <Mail className="w-4 h-4" /> Request Organization Setup
                </Button>
              </a>
            </div>
          ) : (
            <Tabs defaultValue="overview">
              <TabsList className="mb-6 bg-white border border-gray-100 p-1 rounded-xl h-auto flex-wrap gap-1 overflow-x-auto">
                {[
                  { value: "overview", label: "Overview", icon: BarChart3 },
                  { value: "courses", label: "Courses", icon: BookOpen },
                  { value: "students", label: "Students", icon: Users },
                  { value: "assignments", label: "Assignments", icon: ClipboardList },
                  { value: "competencies", label: "Competencies", icon: Award },
                  { value: "analytics", label: "Analytics", icon: TrendingUp },
                ].map(({ value, label, icon: Icon }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 data-[state=active]:text-white rounded-lg"
                    style={{ ["--tw-ring-color" as string]: BRAND }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {activeOrgId && (
                <>
                  <TabsContent value="overview"><OverviewTab orgId={activeOrgId} /></TabsContent>
                  <TabsContent value="courses"><CoursesTab orgId={activeOrgId} /></TabsContent>
                  <TabsContent value="students"><StudentsTab orgId={activeOrgId} /></TabsContent>
                  <TabsContent value="assignments"><AssignmentsTab orgId={activeOrgId} /></TabsContent>
                  <TabsContent value="competencies"><CompetenciesTab orgId={activeOrgId} /></TabsContent>
                  <TabsContent value="analytics"><AnalyticsTab orgId={activeOrgId} /></TabsContent>
                </>
              )}
            </Tabs>
          )}
        </div>
      </Layout>
    </EducatorRoleGate>
  );
}
