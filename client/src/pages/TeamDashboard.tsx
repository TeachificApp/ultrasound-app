/**
 * TeamDashboard — /team or /team/:teamId
 * Seat management dashboard for team admins. Shows member list, invite form, seat usage.
 */
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Users, Mail, Trash2, RefreshCw, Plus, Building2, Loader2,
  Crown, ArrowLeft, ChevronRight,
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  if (status === "accepted") return <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30">Active</Badge>;
  if (status === "pending") return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">Pending</Badge>;
  if (status === "revoked") return <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Revoked</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function TeamDashboard() {
  const [, navigate] = useLocation();
  const params = useParams<{ teamId?: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  const myTeamsQuery = trpc.team.getMyTeams.useQuery(undefined, {
    enabled: !!user,
  });

  const teams = myTeamsQuery.data ?? [];
  const selectedTeamId = params.teamId ? parseInt(params.teamId) : teams[0]?.id;
  const selectedTeam = teams.find(t => t.id === selectedTeamId) ?? teams[0];

  const detailsQuery = trpc.team.getTeamDetails.useQuery(
    { teamId: selectedTeamId! },
    { enabled: !!selectedTeamId },
  );

  const inviteMutation = trpc.team.inviteMember.useMutation({
    onSuccess: () => {
      toast.success(`Invite sent to ${inviteEmail}.`);
      setInviteEmail("");
      setIsInviting(false);
      detailsQuery.refetch();
    },
    onError: (err) => {
      toast.error(err.message);
      setIsInviting(false);
    },
  });

  const revokeMutation = trpc.team.revokeMember.useMutation({
    onSuccess: () => {
      toast.success("Seat revoked. The member's access has been removed.");
      detailsQuery.refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const resendMutation = trpc.team.resendInvite.useMutation({
    onSuccess: () => toast.success("Invite resent!"),
    onError: (err) => toast.error(err.message),
  });

  if (authLoading || myTeamsQuery.isLoading || (selectedTeamId && detailsQuery.isLoading && !detailsQuery.data)) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Sign in required</h2>
          <Button onClick={() => { window.location.href = getLoginUrl("/team"); }} className="bg-teal-500 hover:bg-teal-400 text-white">
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Building2 className="h-10 w-10 text-white/30" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-2">No team subscription yet</h1>
            <p className="text-white/60">Purchase a team subscription to manage seats and invite members.</p>
          </div>
          <Button onClick={() => navigate("/team/subscribe")} className="bg-teal-500 hover:bg-teal-400 text-white font-semibold" size="lg">
            Get team access <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  const members = detailsQuery.data?.members ?? [];
  const usedSeats = members.filter(m => m.inviteStatus === "accepted").length;
  const pendingSeats = members.filter(m => m.inviteStatus === "pending").length;
  const availableSeats = (selectedTeam?.seatCount ?? 0) - usedSeats - pendingSeats;

  const handleInvite = () => {
    if (!inviteEmail.trim() || !selectedTeamId) return;
    setIsInviting(true);
    inviteMutation.mutate({
      teamId: selectedTeamId,
      email: inviteEmail.trim(),
      origin: window.location.origin,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="text-white/60 hover:text-white text-sm flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Crown className="h-4 w-4 text-amber-400" />
          Team Admin
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        {/* Team selector (if multiple teams) */}
        {teams.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {teams.map(t => (
              <button
                key={t.id}
                onClick={() => navigate(`/team/${t.id}`)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                  t.id === selectedTeamId
                    ? "bg-teal-500 border-teal-400 text-white"
                    : "border-white/20 text-white/60 hover:border-white/40"
                }`}
              >
                {t.orgName}
              </button>
            ))}
          </div>
        )}

        {/* Team info */}
        {selectedTeam && (
          <div>
            <h1 className="text-3xl font-bold">{selectedTeam.orgName}</h1>
            <p className="text-white/50 mt-1 text-sm capitalize">
              {selectedTeam.brand === "dual" ? "Both Apps" : selectedTeam.brand === "aaus" ? "UltrasoundAssist™" : "EchoAssist™"}
              {" · "}
              {selectedTeam.plan} plan
              {selectedTeam.status !== "active" && (
                <span className="ml-2 text-red-400">({selectedTeam.status})</span>
              )}
            </p>
          </div>
        )}

        {/* Seat stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total seats", value: selectedTeam?.seatCount ?? 0, color: "text-white" },
            { label: "Active", value: usedSeats, color: "text-teal-400" },
            { label: "Pending", value: pendingSeats, color: "text-amber-400" },
            { label: "Available", value: Math.max(0, availableSeats), color: availableSeats > 0 ? "text-white/60" : "text-red-400" },
          ].map(stat => (
            <Card key={stat.label} className="bg-white/5 border-white/10 text-white">
              <CardContent className="pt-4 pb-3">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-white/50 mt-0.5">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Invite form */}
        <Card className="bg-white/5 border-white/10 text-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-teal-400" />
              Invite a member
            </CardTitle>
            <CardDescription className="text-white/50">
              {availableSeats > 0
                ? `${availableSeats} seat${availableSeats > 1 ? "s" : ""} available`
                : "No seats available — all seats are in use or pending."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder="colleague@hospital.org"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                disabled={availableSeats <= 0}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 flex-1"
              />
              <Button
                onClick={handleInvite}
                disabled={isInviting || !inviteEmail.trim() || availableSeats <= 0}
                className="bg-teal-500 hover:bg-teal-400 text-white"
              >
                {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-4 w-4 mr-1.5" />Send invite</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Members list */}
        <Card className="bg-white/5 border-white/10 text-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-400" />
              Members ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detailsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-white/40">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No members yet. Send your first invite above.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium">
                        {m.inviteEmail?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{m.userName ?? m.inviteEmail}</div>
                        {m.userName && m.inviteEmail && (
                          <div className="text-xs text-white/40">{m.inviteEmail}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={m.inviteStatus} />
                      {m.inviteStatus === "pending" && (
                        <button
                          onClick={() => resendMutation.mutate({ memberId: m.id, origin: window.location.origin })}
                          className="text-white/40 hover:text-white p-1 rounded"
                          title="Resend invite"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {m.inviteStatus !== "revoked" && (
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${m.inviteEmail} from the team?`)) {
                              revokeMutation.mutate({ memberId: m.id });
                            }
                          }}
                          className="text-white/40 hover:text-red-400 p-1 rounded"
                          title="Revoke access"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add more seats CTA */}
        {availableSeats <= 0 && (
          <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg px-5 py-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-teal-300">Need more seats?</p>
              <p className="text-sm text-white/60 mt-0.5">Purchase additional seats to invite more members.</p>
            </div>
            <Button onClick={() => navigate("/team/subscribe")} className="bg-teal-500 hover:bg-teal-400 text-white shrink-0">
              Add seats
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
