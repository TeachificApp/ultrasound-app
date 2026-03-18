/*
  Accreditation Manager Hub — iHeartEcho™
  Access: platform_admin | accreditation_manager roles

  Sections:
    1. DIY Organizations — list + drill-down (Seats | Facility | Readiness | Forms | Analytics | Tasks)
    2. Managed Accounts  — full-service (non-DIY) facilities
    3. Create Account    — create pending user without SuperAdmin

  Brand: Teal #189aa1, Aqua #4ad9e0, Dark Navy #0e1e2e
*/
import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2, Users, Settings, ChevronRight, ChevronLeft, Loader2,
  AlertTriangle, CheckCircle, Plus, ClipboardList, BarChart2,
  FileText, Zap, Shield, Crown, Star, Mail, Calendar, Clock,
  RefreshCw, Trash2, Edit, UserPlus, Activity, BookOpen, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import AccreditationReportingDashboard from "./AccreditationReportingDashboard";

const BRAND = "#189aa1";
const NAVY = "#0e1e2e";
const AQUA = "#4ad9e0";

// ─── Types ────────────────────────────────────────────────────────────────────
type Section = "diy-orgs" | "managed-accounts" | "create-account" | "reports";
type OrgTab = "overview" | "seats" | "facility" | "readiness" | "forms" | "analytics" | "tasks";

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  starter: { label: "Starter", color: "#6b7280" },
  professional: { label: "Professional", color: BRAND },
  advanced: { label: "Advanced", color: "#7c3aed" },
  partner: { label: "Partner", color: "#d97706" },
  // Consulting Client: only assignable by Accreditation Managers / Platform Admins
  consulting_client: { label: "Consulting Client", color: "#0284c7" },
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  trialing: "bg-blue-100 text-blue-800",
  past_due: "bg-orange-100 text-orange-800",
  canceled: "bg-red-100 text-red-800",
  paused: "bg-gray-100 text-gray-600",
};

const ACCRED_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-800",
  submitted: "bg-yellow-100 text-yellow-800",
  accredited: "bg-green-100 text-green-800",
  expired: "bg-red-100 text-red-800",
  suspended: "bg-orange-100 text-orange-800",
};

const TASK_TYPE_LABELS: Record<string, string> = {
  image_quality_review: "Image Quality Review",
  peer_review: "Physician Peer Review",
  echo_correlation: "Echo Correlation",
  case_mix_submission: "Case Mix Submission",
  readiness_checklist: "Readiness Checklist",
  document_upload: "Document Upload",
  facility_information: "Facility Information",
  general: "General",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  normal: "bg-blue-100 text-blue-800",
  low: "bg-gray-100 text-gray-600",
};

const TASK_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-600",
};

// ─── Assign Task Dialog ───────────────────────────────────────────────────────
function AssignTaskDialog({
  open,
  onClose,
  managedAccountId,
  diyOrgId,
  facilityName,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  managedAccountId?: number;
  diyOrgId?: number;
  facilityName: string;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [dueDate, setDueDate] = useState("");
  const [assigneeEmail, setAssigneeEmail] = useState("");
  const [assigneeName, setAssigneeName] = useState("");

  const assignMutation = trpc.accreditationManager.assignTask.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.emailSent
          ? `Task assigned and email sent to ${assigneeEmail}`
          : `Task assigned (email not sent — check SendGrid config)`
      );
      onSuccess();
      onClose();
      setTitle(""); setDescription(""); setAssigneeEmail(""); setAssigneeName("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!title.trim()) return toast.error("Task title is required");
    if (!assigneeEmail.trim()) return toast.error("Assignee email is required");
    assignMutation.mutate({
      managedAccountId,
      diyOrgId,
      title: title.trim(),
      description: description.trim() || undefined,
      taskType: taskType as any,
      priority: priority as any,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      assignedToEmail: assigneeEmail.trim(),
      assignedToName: assigneeName.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" style={{ color: BRAND }} />
            Assign Task — {facilityName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Task Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Submit Q2 Image Quality Reviews" className="mt-1" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Additional context or instructions..." className="mt-1" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Task Type</Label>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Due Date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1" />
          </div>
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Assign To</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={assigneeName} onChange={(e) => setAssigneeName(e.target.value)} placeholder="Contact name" className="mt-1" />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={assigneeEmail} onChange={(e) => setAssigneeEmail(e.target.value)} placeholder="contact@facility.com" className="mt-1" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={assignMutation.isPending} style={{ background: BRAND, color: "#fff" }}>
            {assignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
            Assign & Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Task List ────────────────────────────────────────────────────────────────
function TaskList({ managedAccountId, diyOrgId, facilityName }: { managedAccountId?: number; diyOrgId?: number; facilityName: string }) {
  const [showAssign, setShowAssign] = useState(false);
  const { data: tasks, isLoading, refetch } = trpc.accreditationManager.listTasks.useQuery(
    { managedAccountId, diyOrgId },
    { enabled: !!(managedAccountId || diyOrgId) }
  );
  const updateStatus = trpc.accreditationManager.updateTaskStatus.useMutation({
    onSuccess: () => { toast.success("Task updated"); refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const deleteTask = trpc.accreditationManager.deleteTask.useMutation({
    onSuccess: () => { toast.success("Task deleted"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Task Assignments</h3>
        <Button size="sm" onClick={() => setShowAssign(true)} style={{ background: BRAND, color: "#fff" }}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Assign Task
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : !tasks?.length ? (
        <div className="text-center py-10 text-gray-400">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No tasks assigned yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="border border-gray-100 rounded-lg p-4 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-sm text-gray-800">{task.title}</span>
                    <Badge className={`text-xs ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</Badge>
                    <Badge className={`text-xs ${TASK_STATUS_COLORS[task.status]}`}>{task.status.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{TASK_TYPE_LABELS[task.taskType]}</p>
                  {task.description && <p className="text-xs text-gray-600 mb-2">{task.description}</p>}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    {task.assignedToName && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{task.assignedToName}</span>}
                    {task.assignedToEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{task.assignedToEmail}</span>}
                    {task.dueDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Due {new Date(task.dueDate).toLocaleDateString()}</span>}
                    <span className={`flex items-center gap-1 ${task.emailStatus === "sent" ? "text-green-600" : task.emailStatus === "failed" ? "text-red-500" : ""}`}>
                      <Mail className="w-3 h-3" />Email: {task.emailStatus.replace("_", " ")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Select value={task.status} onValueChange={(v) => updateStatus.mutate({ taskId: task.id, status: v as any })}>
                    <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => deleteTask.mutate({ taskId: task.id })}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <AssignTaskDialog
        open={showAssign}
        onClose={() => setShowAssign(false)}
        managedAccountId={managedAccountId}
        diyOrgId={diyOrgId}
        facilityName={facilityName}
        onSuccess={refetch}
      />
    </div>
  );
}

// ─── DIY Org Detail Drill-Down ────────────────────────────────────────────────
function DiyOrgDetail({ orgId, onBack }: { orgId: number; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<OrgTab>("overview");
  const [editingFacility, setEditingFacility] = useState(false);
  const [facilityName, setFacilityName] = useState("");
  const [accreditationTypes, setAccreditationTypes] = useState("");

  const { data, isLoading, refetch } = trpc.accreditationManager.getDiyOrgDetail.useQuery({ orgId });
  const { data: analytics } = trpc.accreditationManager.getDiyOrgAnalytics.useQuery({ orgId });
  const updateFacility = trpc.accreditationManager.updateDiyOrgFacility.useMutation({
    onSuccess: () => { toast.success("Facility info updated"); setEditingFacility(false); refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const updateSub = trpc.accreditationManager.updateDiyOrgSubscription.useMutation({
    onSuccess: () => { toast.success("Subscription updated"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND }} /></div>;
  if (!data) return <div className="text-center py-16 text-gray-400">Organization not found</div>;

  const { org, subscription, members } = data;
  const plan = subscription?.plan ?? "starter";
  const planInfo = PLAN_LABELS[plan] ?? { label: plan, color: "#6b7280" };
  const subStatus = subscription?.status ?? "active";

  const tabs: { id: OrgTab; label: string; icon: typeof Building2 }[] = [
    { id: "overview", label: "Overview", icon: Building2 },
    { id: "seats", label: "Seats", icon: Users },
    { id: "facility", label: "Facility", icon: Settings },
    { id: "analytics", label: "Analytics", icon: BarChart2 },
    { id: "tasks", label: "Tasks", icon: ClipboardList },
  ];

  return (
    <div>
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-500">
          <ChevronLeft className="w-4 h-4 mr-1" /> All Organizations
        </Button>
        <ChevronRight className="w-4 h-4 text-gray-300" />
        <span className="font-semibold text-gray-800">{org.name}</span>
        <Badge style={{ background: planInfo.color + "20", color: planInfo.color }} className="text-xs font-semibold">{planInfo.label}</Badge>
        <Badge className={`text-xs ${STATUS_COLORS[subStatus] ?? "bg-gray-100 text-gray-600"}`}>{subStatus.replace("_", " ")}</Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 mb-6 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === id ? "text-white" : "text-gray-500 hover:text-gray-700"
            }`}
            style={activeTab === id ? { background: BRAND } : {}}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-gray-500 mb-1">Total Members</p>
              <p className="text-3xl font-bold" style={{ color: BRAND }}>{members.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-gray-500 mb-1">Seats Used</p>
              <p className="text-3xl font-bold text-gray-800">
                {members.filter((m) => m.member.inviteStatus === "accepted").length}
                <span className="text-base text-gray-400 ml-1">/ {subscription?.totalSeats ?? "—"}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-gray-500 mb-1">Accreditation Types</p>
              <p className="text-sm font-medium text-gray-700 mt-1">
                {org.accreditationTypes
                  ? JSON.parse(org.accreditationTypes).join(", ")
                  : "Not set"}
              </p>
            </CardContent>
          </Card>
          {analytics && (
            <>
              {[
                { label: "IQR Submissions", value: analytics.iqrCount, icon: Activity },
                { label: "Peer Reviews", value: analytics.peerReviewCount, icon: FileText },
                { label: "Echo Correlations", value: analytics.echoCorrelationCount, icon: Zap },
                { label: "Case Mix Submissions", value: analytics.caseMixCount, icon: BookOpen },
                { label: "Form Submissions", value: analytics.formSubCount, icon: ClipboardList },
              ].map(({ label, value, icon: Icon }) => (
                <Card key={label}>
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4" style={{ color: BRAND }} />
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      {activeTab === "seats" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Seat Management</h3>
            <div className="flex items-center gap-3">
              <Select
                value={subscription?.plan ?? "starter"}
                onValueChange={(v) => updateSub.mutate({ orgId, plan: v as any })}
              >
                <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Plan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter (5 seats)</SelectItem>
                  <SelectItem value="professional">Professional (15 seats)</SelectItem>
                  <SelectItem value="advanced">Advanced (50 seats)</SelectItem>
                  <SelectItem value="partner">Partner (Unlimited)</SelectItem>
                  <SelectItem value="consulting_client">Consulting Client</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={subscription?.status ?? "active"}
                onValueChange={(v) => updateSub.mutate({ orgId, status: v as any })}
              >
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            {members.map(({ member, user: u }) => (
              <div key={member.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg bg-white">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: member.diyRole === "super_admin" ? "#d97706" : member.diyRole === "lab_admin" ? BRAND : "#6b7280" }}>
                  {(u?.displayName ?? u?.name ?? member.displayName ?? "?")[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{u?.displayName ?? u?.name ?? member.displayName ?? member.inviteEmail}</p>
                  <p className="text-xs text-gray-400">{u?.email ?? member.inviteEmail}</p>
                </div>
                <Badge className={`text-xs ${
                  member.diyRole === "super_admin" ? "bg-amber-100 text-amber-800" :
                  member.diyRole === "lab_admin" ? "bg-teal-100 text-teal-800" :
                  "bg-blue-100 text-blue-800"
                }`}>{member.diyRole.replace("_", " ")}</Badge>
                <Badge className={`text-xs ${
                  member.inviteStatus === "accepted" ? "bg-green-100 text-green-800" :
                  member.inviteStatus === "pending" ? "bg-yellow-100 text-yellow-800" :
                  "bg-gray-100 text-gray-600"
                }`}>{member.inviteStatus}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "facility" && (
        <div className="max-w-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Facility Information</h3>
            <Button size="sm" variant="outline" onClick={() => {
              setFacilityName(org.name);
              setAccreditationTypes(org.accreditationTypes ?? "");
              setEditingFacility(true);
            }}>
              <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
            </Button>
          </div>
          {editingFacility ? (
            <div className="space-y-4">
              <div>
                <Label>Organization Name</Label>
                <Input value={facilityName} onChange={(e) => setFacilityName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Accreditation Types (JSON array)</Label>
                <Input value={accreditationTypes} onChange={(e) => setAccreditationTypes(e.target.value)} placeholder='["Adult Echo","Pediatric/Fetal"]' className="mt-1" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => updateFacility.mutate({ orgId, name: facilityName, accreditationTypes })} disabled={updateFacility.isPending} style={{ background: BRAND, color: "#fff" }}>
                  {updateFacility.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CheckCircle className="w-3.5 h-3.5 mr-1.5" />} Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingFacility(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="text-sm text-gray-500 w-40">Organization Name</span>
                <span className="text-sm font-medium text-gray-800">{org.name}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-sm text-gray-500 w-40">Accreditation Types</span>
                <span className="text-sm font-medium text-gray-800">
                  {org.accreditationTypes ? JSON.parse(org.accreditationTypes).join(", ") : "Not set"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "analytics" && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-4">Analytics Summary</h3>
          {!analytics ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "Image Quality Reviews", value: analytics.iqrCount, icon: Activity, color: BRAND },
                { label: "Physician Peer Reviews", value: analytics.peerReviewCount, icon: FileText, color: "#7c3aed" },
                { label: "Echo Correlations", value: analytics.echoCorrelationCount, icon: Zap, color: "#d97706" },
                { label: "Case Mix Submissions", value: analytics.caseMixCount, icon: BookOpen, color: "#059669" },
                { label: "Form Submissions", value: analytics.formSubCount, icon: ClipboardList, color: "#2563eb" },
                { label: "Readiness Records", value: analytics.readinessRows?.length ?? 0, icon: CheckCircle, color: "#dc2626" },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label}>
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + "18" }}>
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                    <p className="text-3xl font-bold" style={{ color }}>{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "tasks" && (
        <TaskList diyOrgId={orgId} facilityName={org.name} />
      )}
    </div>
  );
}

// ─── Create Shell Org Dialog ───────────────────────────────────────────────────────────────────────────────────
function CreateShellOrgDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (orgId: number) => void }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [facilityType, setFacilityType] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("USA");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [plan, setPlan] = useState<"starter" | "professional" | "advanced" | "partner" | "consulting_client">("consulting_client");
  const [accredTypes, setAccredTypes] = useState<string[]>([]);

  const createMutation = trpc.accreditationManager.createShellOrganization.useMutation({
    onSuccess: (data) => {
      utils.accreditationManager.listDiyOrgs.invalidate();
      toast.success(`Organization "${name}" created successfully`);
      onCreated(data.orgId);
      // Reset form
      setName(""); setFacilityType(""); setAddress(""); setCity(""); setState("");
      setZip(""); setCountry("USA"); setPhone(""); setWebsite("");
      setContactName(""); setContactEmail(""); setNotes("");
      setPlan("consulting_client"); setAccredTypes([]);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleAccredType = (type: string) => {
    setAccredTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  };

  const handleSubmit = () => {
    if (!name.trim()) { toast.error("Organization name is required"); return; }
    createMutation.mutate({
      name: name.trim(),
      facilityType: facilityType || undefined,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      zip: zip || undefined,
      country: country || undefined,
      phone: phone || undefined,
      website: website || undefined,
      contactName: contactName || undefined,
      contactEmail: contactEmail || undefined,
      notes: notes || undefined,
      plan,
      accreditationTypes: accredTypes.length > 0 ? (accredTypes as ("adult_echo" | "pediatric_fetal_echo")[]) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold" style={{ fontFamily: "Merriweather, serif" }}>
            Create Organization (No User Accounts)
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Creates a shell organization record without any user accounts. Useful for tracking consulting clients or facilities not yet onboarded.
          </p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Plan selector — Consulting Client is the default and highlighted */}
          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-2 block">Plan Assignment</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {([
                { value: "consulting_client", label: "Consulting Client", color: "#0284c7", note: "Manager/Admin only" },
                { value: "starter", label: "Starter", color: "#6b7280", note: "" },
                { value: "professional", label: "Professional", color: BRAND, note: "" },
                { value: "advanced", label: "Advanced", color: "#7c3aed", note: "" },
                { value: "partner", label: "Partner", color: "#d97706", note: "" },
              ] as const).map(({ value, label, color, note }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPlan(value)}
                  className={`flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all ${
                    plan === value ? "shadow-sm" : "border-gray-100 bg-white hover:border-gray-200"
                  }`}
                  style={plan === value ? { borderColor: color, background: color + "10" } : {}}
                >
                  <span className="text-xs font-bold" style={{ color: plan === value ? color : "#374151" }}>{label}</span>
                  {note && <span className="text-[10px] mt-0.5" style={{ color }}>{note}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Organization name */}
          <div>
            <Label htmlFor="shell-org-name" className="text-sm font-medium text-gray-700">Organization Name <span className="text-red-500">*</span></Label>
            <Input id="shell-org-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riverside Cardiology Lab" className="mt-1" />
          </div>

          {/* Facility type + accreditation types */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Facility Type</Label>
              <Select value={facilityType} onValueChange={setFacilityType}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hospital">Hospital</SelectItem>
                  <SelectItem value="Outpatient Clinic">Outpatient Clinic</SelectItem>
                  <SelectItem value="Mobile Echo">Mobile Echo</SelectItem>
                  <SelectItem value="Academic Medical Center">Academic Medical Center</SelectItem>
                  <SelectItem value="Private Practice">Private Practice</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Accreditation Types</Label>
              <div className="flex gap-2 mt-2">
                {["adult_echo", "pediatric_fetal_echo"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleAccredType(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      accredTypes.includes(t) ? "text-white" : "bg-white border-gray-200 text-gray-600"
                    }`}
                    style={accredTypes.includes(t) ? { background: BRAND, borderColor: BRAND } : {}}
                  >
                    {t === "adult_echo" ? "Adult Echo" : "Pediatric/Fetal"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <Label className="text-sm font-medium text-gray-700">Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2">
              <Label className="text-sm font-medium text-gray-700">City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">State</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="State" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">ZIP</Label>
              <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="ZIP" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Country</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className="mt-1" />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Contact Name</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Primary contact" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Contact Email</Label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="contact@facility.com" className="mt-1" />
            </div>
          </div>

          {/* Website */}
          <div>
            <Label className="text-sm font-medium text-gray-700">Website</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className="mt-1" />
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-medium text-gray-700">Internal Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes about this organization..." className="mt-1" rows={3} />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} disabled={createMutation.isPending}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || !name.trim()}
            style={{ background: BRAND, color: "#fff" }}
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Create Organization
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── DIY Orgs Panel ───────────────────────────────────────────────────────────────────────────────────
function DiyOrgsPanel() {
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { data: orgs, isLoading } = trpc.accreditationManager.listDiyOrgs.useQuery();

  const filtered = useMemo(() => {
    if (!orgs) return [];
    const q = search.toLowerCase();
    return orgs.filter((o) => o.org.name.toLowerCase().includes(q));
  }, [orgs, search]);

  if (selectedOrgId !== null) {
    return <DiyOrgDetail orgId={selectedOrgId} onBack={() => setSelectedOrgId(null)} />;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Input
          placeholder="Search organizations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-sm text-gray-400">{filtered.length} org{filtered.length !== 1 ? "s" : ""}</span>
        <div className="ml-auto">
          <Button
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            style={{ background: BRAND, color: "#fff" }}
          >
            <Plus className="w-4 h-4 mr-1" /> Create Organization
          </Button>
        </div>
      </div>
      <CreateShellOrgDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={(orgId) => { setShowCreateDialog(false); setSelectedOrgId(orgId); }}
      />
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND }} /></div>
      ) : !filtered.length ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No DIY organizations found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ org, subscription, memberCount }) => {
            const plan = subscription?.plan ?? "starter";
            const planInfo = PLAN_LABELS[plan] ?? { label: plan, color: "#6b7280" };
            const subStatus = subscription?.status ?? "active";
            const types = org.accreditationTypes ? JSON.parse(org.accreditationTypes) : [];
            return (
              <div
                key={org.id}
                className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl bg-white hover:border-teal-200 hover:shadow-sm cursor-pointer transition-all group"
                onClick={() => setSelectedOrgId(org.id)}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: org.isShellOrg ? "#0284c718" : BRAND + "18" }}>
                  <Building2 className="w-5 h-5" style={{ color: org.isShellOrg ? "#0284c7" : BRAND }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800 group-hover:text-teal-700 transition-colors">{org.name}</p>
                    {org.isShellOrg && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "#0284c715", color: "#0284c7" }}>No User Accounts</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {org.city && org.state ? `${org.city}, ${org.state} · ` : ""}
                    {types.join(" · ") || "No accreditation types set"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge style={{ background: planInfo.color + "20", color: planInfo.color }} className="text-xs">{planInfo.label}</Badge>
                  <Badge className={`text-xs ${STATUS_COLORS[subStatus] ?? "bg-gray-100 text-gray-600"}`}>{subStatus.replace("_", " ")}</Badge>
                  <span className="text-xs text-gray-400 flex items-center gap-1"><Users className="w-3 h-3" />{memberCount}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-teal-500 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Managed Accounts Panel ───────────────────────────────────────────────────
function ManagedAccountsPanel() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // Create form state
  const [facilityName, setFacilityName] = useState("");
  const [facilityType, setFacilityType] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [accreditationBody, setAccreditationBody] = useState("");
  const [notes, setNotes] = useState("");

  const { data: accounts, isLoading, refetch } = trpc.accreditationManager.listManagedAccounts.useQuery();
  const createMutation = trpc.accreditationManager.createManagedAccount.useMutation({
    onSuccess: () => {
      toast.success("Managed account created");
      setShowCreate(false);
      setFacilityName(""); setFacilityType(""); setCity(""); setState(""); setContactName(""); setContactEmail(""); setContactTitle(""); setAccreditationBody(""); setNotes("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    if (!accounts) return [];
    const q = search.toLowerCase();
    return accounts.filter((a) => a.account.facilityName.toLowerCase().includes(q));
  }, [accounts, search]);

  if (selectedAccountId !== null) {
    const acct = accounts?.find((a) => a.account.id === selectedAccountId);
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setSelectedAccountId(null)} className="text-gray-500">
            <ChevronLeft className="w-4 h-4 mr-1" /> All Managed Accounts
          </Button>
          <ChevronRight className="w-4 h-4 text-gray-300" />
          <span className="font-semibold text-gray-800">{acct?.account.facilityName}</span>
        </div>
        {acct && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Facility Type", value: acct.account.facilityType ?? "—" },
                { label: "Location", value: [acct.account.city, acct.account.state].filter(Boolean).join(", ") || "—" },
                { label: "Contact", value: acct.account.contactName ?? "—" },
                { label: "Accreditation Body", value: acct.account.accreditationBody ?? "—" },
              ].map(({ label, value }) => (
                <Card key={label}>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    <p className="text-sm font-medium text-gray-800">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Badge className={`text-xs ${ACCRED_STATUS_COLORS[acct.account.currentAccreditationStatus]}`}>
                {acct.account.currentAccreditationStatus.replace("_", " ")}
              </Badge>
              {acct.account.contactEmail && (
                <a href={`mailto:${acct.account.contactEmail}`} className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                  <Mail className="w-3 h-3" />{acct.account.contactEmail}
                </a>
              )}
            </div>
            {acct.account.notes && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{acct.account.notes}</p>
              </div>
            )}
            <TaskList managedAccountId={acct.account.id} facilityName={acct.account.facilityName} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Input placeholder="Search managed accounts..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Button size="sm" onClick={() => setShowCreate(true)} style={{ background: BRAND, color: "#fff" }}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Account
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND }} /></div>
      ) : !filtered.length ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No managed accounts yet</p>
          <Button size="sm" className="mt-4" onClick={() => setShowCreate(true)} style={{ background: BRAND, color: "#fff" }}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add First Account
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ account, manager }) => (
            <div
              key={account.id}
              className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl bg-white hover:border-teal-200 hover:shadow-sm cursor-pointer transition-all group"
              onClick={() => setSelectedAccountId(account.id)}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#7c3aed18" }}>
                <Building2 className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 group-hover:text-teal-700 transition-colors">{account.facilityName}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {[account.city, account.state].filter(Boolean).join(", ")}
                  {account.accreditationBody ? ` · ${account.accreditationBody}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge className={`text-xs ${ACCRED_STATUS_COLORS[account.currentAccreditationStatus]}`}>
                  {account.currentAccreditationStatus.replace("_", " ")}
                </Badge>
                {manager && (
                  <span className="text-xs text-gray-400">{manager.displayName ?? manager.name}</span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-teal-500 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Account Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" style={{ color: BRAND }} />
              Add Managed Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Facility Name *</Label>
              <Input value={facilityName} onChange={(e) => setFacilityName(e.target.value)} placeholder="e.g. Riverside Medical Center" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Facility Type</Label>
                <Select value={facilityType} onValueChange={setFacilityType}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hospital">Hospital</SelectItem>
                    <SelectItem value="Outpatient Clinic">Outpatient Clinic</SelectItem>
                    <SelectItem value="Cardiology Practice">Cardiology Practice</SelectItem>
                    <SelectItem value="Mobile Echo">Mobile Echo</SelectItem>
                    <SelectItem value="Academic Medical Center">Academic Medical Center</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Accreditation Body</Label>
                <Select value={accreditationBody} onValueChange={setAccreditationBody}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IAC">IAC</SelectItem>
                    <SelectItem value="ICAEL">ICAEL</SelectItem>
                    <SelectItem value="ACR">ACR</SelectItem>
                    <SelectItem value="JCAHO">JCAHO</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>State</Label>
                <Input value={state} onChange={(e) => setState(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Primary Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input value={contactName} onChange={(e) => setContactName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Title</Label>
                  <Input value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div className="mt-3">
                <Label>Email</Label>
                <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate({ facilityName, facilityType: facilityType || undefined, city: city || undefined, state: state || undefined, contactName: contactName || undefined, contactEmail: contactEmail || undefined, contactTitle: contactTitle || undefined, accreditationBody: accreditationBody || undefined, notes: notes || undefined })} disabled={createMutation.isPending || !facilityName.trim()} style={{ background: BRAND, color: "#fff" }}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Create Account Panel ─────────────────────────────────────────────────────
function CreateAccountPanel() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [credentials, setCredentials] = useState("");
  const [role, setRole] = useState<"diy_admin" | "diy_user" | "accreditation_manager">("diy_user");
  const [result, setResult] = useState<{ userId: number } | null>(null);

  const createMutation = trpc.accreditationManager.createManagedUser.useMutation({
    onSuccess: (data) => {
      toast.success(`Account created (User ID: ${data.userId})`);
      setResult(data);
      setEmail(""); setDisplayName(""); setCredentials("");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="max-w-md">
      <p className="text-sm text-gray-500 mb-6">
        Create a pending user account without requiring SuperAdmin. The user will receive an invite to set their password.
      </p>
      <div className="space-y-4">
        <div>
          <Label>Email Address *</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@facility.com" className="mt-1" />
        </div>
        <div>
          <Label>Display Name *</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Dr. Jane Smith" className="mt-1" />
        </div>
        <div>
          <Label>Credentials</Label>
          <Input value={credentials} onChange={(e) => setCredentials(e.target.value)} placeholder="RDCS, RDMS, MD..." className="mt-1" />
        </div>
        <div>
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as any)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="diy_user">DIY Member</SelectItem>
              <SelectItem value="diy_admin">DIY Lab Admin</SelectItem>
              <SelectItem value="accreditation_manager">Accreditation Manager</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => createMutation.mutate({ email, displayName, credentials: credentials || undefined, role })}
          disabled={createMutation.isPending || !email.trim() || !displayName.trim()}
          style={{ background: BRAND, color: "#fff" }}
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
          Create Account
        </Button>
      </div>
      {result && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">Account created successfully</p>
            <p className="text-xs text-green-600 mt-1">User ID: {result.userId} — The user can now log in and set their password via the Forgot Password flow.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AccreditationManager() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>("diy-orgs");

  if (authLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND }} />
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-amber-500" />
          <p className="text-gray-600">Please sign in to access the Accreditation Manager.</p>
        </div>
      </Layout>
    );
  }

  const sections: { id: Section; label: string; icon: typeof Building2; description: string }[] = [
    { id: "diy-orgs", label: "DIY Organizations", icon: Building2, description: "Drill into every DIY org — seats, facility info, readiness, forms, analytics, and task assignment" },
    { id: "managed-accounts", label: "Managed Accounts", icon: Shield, description: "Full-service (non-DIY) facilities managed directly by the accreditation team" },
    { id: "create-account", label: "Create Account", icon: UserPlus, description: "Create a pending user account without requiring SuperAdmin" },
    { id: "reports", label: "Reporting Dashboard", icon: TrendingUp, description: "Cross-organization metrics: quality scores, peer review concordance, case mix, readiness, and task status" },
  ];

  return (
    <Layout>
      {/* Header */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0e4a50 60%, ${BRAND} 100%)` }}>
        <div className="container py-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: AQUA + "30" }}>
              <Shield className="w-5 h-5" style={{ color: AQUA }} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>
                Accreditation Manager
              </h1>
              <p className="text-sm" style={{ color: AQUA }}>Platform-wide accreditation oversight and management</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Section nav */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeSection === id ? "text-white shadow-sm" : "text-gray-600 bg-white border border-gray-100 hover:border-teal-200"
              }`}
              style={activeSection === id ? { background: BRAND } : {}}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Section content */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="mb-6 pb-4 border-b border-gray-50">
            <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
              {sections.find((s) => s.id === activeSection)?.label}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {sections.find((s) => s.id === activeSection)?.description}
            </p>
          </div>
          {activeSection === "diy-orgs" && <DiyOrgsPanel />}
          {activeSection === "managed-accounts" && <ManagedAccountsPanel />}
          {activeSection === "create-account" && <CreateAccountPanel />}
          {activeSection === "reports" && <AccreditationReportingDashboard />}
        </div>
      </div>
    </Layout>
  );
}
