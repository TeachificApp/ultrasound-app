/**
 * MyTeamPage.tsx
 * Team Manager Dashboard — accessible to users with team_admin or team_manager role.
 * Managers can: assign/revoke seats, resend invites, view analytics.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  UserX,
  Mail,
  BarChart2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  XCircle,
  BookOpen,
  TrendingUp,
  RefreshCw,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusBadge(status: string) {
  if (status === "active") return <Badge className="bg-teal-100 text-teal-700 border-teal-200">Active</Badge>;
  if (status === "pending") return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
  return <Badge className="bg-gray-100 text-gray-500 border-gray-200">Revoked</Badge>;
}

// ─── Assign Seat Dialog ───────────────────────────────────────────────────────
function AssignSeatDialog({
  groupId,
  open,
  onClose,
  onAssigned,
}: {
  groupId: number;
  open: boolean;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const assign = trpc.lmsTeamManager.assignSeat.useMutation({
    onSuccess: () => {
      toast.success("Seat assigned — invite sent");
      setEmail("");
      setName("");
      onAssigned();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign a Seat</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Email address *</label>
            <Input
              type="email"
              placeholder="member@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Name (optional)</label>
            <Input
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            disabled={!email || assign.isPending}
            onClick={() => assign.mutate({ groupId, email, memberName: name || undefined })}
          >
            {assign.isPending ? "Assigning…" : "Assign Seat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Seat Row ─────────────────────────────────────────────────────────────────
function SeatRow({
  seat,
  groupId,
  onRefresh,
}: {
  seat: any;
  groupId: number;
  onRefresh: () => void;
}) {
  const revoke = trpc.lmsTeamManager.revokeSeat.useMutation({
    onSuccess: () => { toast.success("Seat revoked"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });
  const resend = trpc.lmsTeamManager.resendInvite.useMutation({
    onSuccess: () => { toast.success("Invite resent"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
        <span className="text-xs font-semibold text-teal-700">
          {(seat.memberName || seat.email).charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{seat.memberName || seat.email}</p>
        {seat.memberName && <p className="text-xs text-gray-500 truncate">{seat.email}</p>}
      </div>
      <div className="shrink-0">{statusBadge(seat.status)}</div>
      <div className="flex items-center gap-1 shrink-0">
        {seat.status === "pending" && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            disabled={resend.isPending}
            onClick={() => resend.mutate({ seatId: seat.id })}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Resend
          </Button>
        )}
        {seat.status !== "revoked" && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
            disabled={revoke.isPending}
            onClick={() => {
              if (confirm(`Revoke seat for ${seat.email}?`)) revoke.mutate({ seatId: seat.id });
            }}
          >
            <UserX className="w-3 h-3 mr-1" />
            Revoke
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Analytics Panel ──────────────────────────────────────────────────────────
function AnalyticsPanel({ groupId }: { groupId: number }) {
  const { data, isLoading } = trpc.lmsTeamManager.getGroupAnalytics.useQuery({ groupId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!data) return null;

  const { seats, courses, memberProgress } = data;

  return (
    <div className="space-y-5">
      {/* Seat stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Seats", value: seats.total, icon: Users, color: "text-teal-600 bg-teal-50" },
          { label: "Active", value: seats.active, icon: CheckCircle2, color: "text-green-600 bg-green-50" },
          { label: "Pending", value: seats.pending, icon: Clock, color: "text-amber-600 bg-amber-50" },
          { label: "Available", value: seats.available, icon: UserPlus, color: "text-blue-600 bg-blue-50" },
        ].map((s) => (
          <Card key={s.label} className="border-gray-100">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Courses */}
      {courses.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Courses</p>
          <div className="space-y-2">
            {courses.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                <BookOpen className="w-4 h-4 text-teal-500 shrink-0" />
                <span className="flex-1 text-sm text-gray-800 truncate">{c.courseTitle ?? "Untitled"}</span>
                <span className="text-xs text-gray-500 shrink-0">{c.seats} seat{c.seats !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member progress */}
      {memberProgress.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Member Progress</p>
          <div className="space-y-2">
            {memberProgress.map((m: any) => (
              <div key={m.userId} className="bg-gray-50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-teal-700">
                      {(m.name || m.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-800 truncate">{m.name || m.email}</span>
                </div>
                {m.enrollments.map((e: any) => {
                  const course = courses.find((c: any) => c.courseId === e.courseId);
                  return (
                    <div key={e.courseId} className="ml-8 mb-1">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-0.5">
                        <span className="truncate">{course?.courseTitle ?? `Course #${e.courseId}`}</span>
                        <span className="shrink-0 ml-2 font-medium">{Math.round(e.progress)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, e.progress)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {m.enrollments.length === 0 && (
                  <p className="ml-8 text-xs text-gray-400 italic">Not yet enrolled</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {memberProgress.length === 0 && seats.active === 0 && (
        <div className="text-center py-8 text-gray-400">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No active members yet. Assign seats to get started.</p>
        </div>
      )}
    </div>
  );
}

// ─── Group Card ───────────────────────────────────────────────────────────────
function GroupCard({ group }: { group: any }) {
  const [tab, setTab] = useState<"members" | "analytics">("members");
  const [assignOpen, setAssignOpen] = useState(false);
  const utils = trpc.useUtils();

  const refresh = () => utils.lmsTeamManager.getMyManagedGroups.invalidate();

  const activeSeats = (group.seatList ?? []).filter((s: any) => s.status === "active").length;
  const pendingSeats = (group.seatList ?? []).filter((s: any) => s.status === "pending").length;
  const totalAllocated = (group.courses ?? []).reduce((sum: number, c: any) => sum + (c.seats || 0), 0) || group.seats;
  const usedSeats = (group.seatList ?? []).filter((s: any) => s.status !== "revoked").length;
  const availableSeats = Math.max(0, totalAllocated - usedSeats);

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold text-gray-900 truncate">{group.name}</CardTitle>
            {group.orgName && (
              <p className="text-xs text-gray-500 mt-0.5">{group.orgName}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{usedSeats}</span>
            <span>/</span>
            <span>{totalAllocated}</span>
            <span>seats</span>
          </div>
        </div>
        {/* Seat usage bar */}
        <div className="mt-2">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all"
              style={{ width: totalAllocated > 0 ? `${Math.min(100, (usedSeats / totalAllocated) * 100)}%` : "0%" }}
            />
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span><span className="font-medium text-green-600">{activeSeats}</span> active</span>
            <span><span className="font-medium text-amber-600">{pendingSeats}</span> pending</span>
            <span><span className="font-medium text-blue-600">{availableSeats}</span> available</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <div className="flex items-center justify-between mb-3">
            <TabsList className="h-8 bg-gray-100">
              <TabsTrigger value="members" className="text-xs h-7 px-3">
                <Users className="w-3 h-3 mr-1" />
                Members
              </TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs h-7 px-3">
                <BarChart2 className="w-3 h-3 mr-1" />
                Analytics
              </TabsTrigger>
            </TabsList>
            {tab === "members" && availableSeats > 0 && (
              <Button
                size="sm"
                className="h-7 px-3 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                onClick={() => setAssignOpen(true)}
              >
                <UserPlus className="w-3 h-3 mr-1" />
                Assign Seat
              </Button>
            )}
            {tab === "members" && availableSeats === 0 && (
              <span className="text-xs text-gray-400 italic">All seats used</span>
            )}
          </div>

          <TabsContent value="members" className="mt-0">
            {(group.seatList ?? []).length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No members yet.</p>
                {availableSeats > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 text-teal-600 border-teal-200 hover:bg-teal-50"
                    onClick={() => setAssignOpen(true)}
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                    Assign First Seat
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                {(group.seatList ?? [])
                  .filter((s: any) => s.status !== "revoked")
                  .map((seat: any) => (
                    <SeatRow key={seat.id} seat={seat} groupId={group.id} onRefresh={refresh} />
                  ))}
                {(group.seatList ?? []).filter((s: any) => s.status === "revoked").length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                      Show revoked ({(group.seatList ?? []).filter((s: any) => s.status === "revoked").length})
                    </summary>
                    <div className="mt-1 space-y-0.5 opacity-60">
                      {(group.seatList ?? [])
                        .filter((s: any) => s.status === "revoked")
                        .map((seat: any) => (
                          <SeatRow key={seat.id} seat={seat} groupId={group.id} onRefresh={refresh} />
                        ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="mt-0">
            <AnalyticsPanel groupId={group.id} />
          </TabsContent>
        </Tabs>
      </CardContent>

      <AssignSeatDialog
        groupId={group.id}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onAssigned={refresh}
      />
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MyTeamPage() {
  const { user } = useAuth();
  const { data: groups = [], isLoading } = trpc.lmsTeamManager.getMyManagedGroups.useQuery();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
        <p>Please sign in to view your team.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-teal-600" />
          My Team
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage member access and view progress for your assigned teams.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-8 w-8 border-2 border-teal-500 border-t-transparent rounded-full" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium text-gray-500">No teams assigned</p>
          <p className="text-sm mt-1">Contact your administrator to be added as a team manager.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group: any) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
