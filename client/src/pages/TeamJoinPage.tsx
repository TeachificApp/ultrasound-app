/**
 * TeamJoinPage — /team/join?token=xxx
 * Invite acceptance page for team members.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, Users, Building2 } from "lucide-react";

export default function TeamJoinPage() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token"));
  }, []);

  const inviteQuery = trpc.team.getInvite.useQuery(
    { token: token! },
    { enabled: !!token, retry: false },
  );

  const acceptMutation = trpc.team.acceptInvite.useMutation({
    onSuccess: () => setAccepted(true),
    onError: (err) => setError(err.message),
  });

  const handleAccept = () => {
    if (!user) {
      window.location.href = getLoginUrl(`/team/join?token=${token}`);
      return;
    }
    if (token) acceptMutation.mutate({ token });
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Card className="bg-white/5 border-white/10 text-white max-w-sm w-full mx-4">
          <CardContent className="pt-6 text-center space-y-3">
            <XCircle className="h-12 w-12 text-red-400 mx-auto" />
            <h2 className="text-xl font-semibold">Invalid invite link</h2>
            <p className="text-white/60 text-sm">This invite link is missing a token. Please check the email you received.</p>
            <Button variant="ghost" onClick={() => navigate("/")} className="text-white/60 hover:text-white">Return home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inviteQuery.isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    );
  }

  if (inviteQuery.error || !inviteQuery.data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Card className="bg-white/5 border-white/10 text-white max-w-sm w-full mx-4">
          <CardContent className="pt-6 text-center space-y-3">
            <XCircle className="h-12 w-12 text-red-400 mx-auto" />
            <h2 className="text-xl font-semibold">Invite not found</h2>
            <p className="text-white/60 text-sm">{inviteQuery.error?.message ?? "This invite link may have expired or already been used."}</p>
            <Button variant="ghost" onClick={() => navigate("/")} className="text-white/60 hover:text-white">Return home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-teal-400" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">You're in!</h1>
            <p className="text-white/60">You now have premium access as part of <strong className="text-white">{inviteQuery.data.orgName}</strong>.</p>
          </div>
          <Button onClick={() => navigate("/")} className="bg-teal-500 hover:bg-teal-400 text-white font-semibold" size="lg">
            Start exploring →
          </Button>
        </div>
      </div>
    );
  }

  const invite = inviteQuery.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-teal-500/20 border border-teal-500/30 rounded-full px-4 py-1.5 text-teal-300 text-sm font-medium mb-4">
            <Users className="h-4 w-4" />
            Team Invitation
          </div>
          <h1 className="text-3xl font-bold mb-2">You've been invited</h1>
          <p className="text-white/60">
            Join <strong className="text-white">{invite.orgName}</strong> and get premium access.
          </p>
        </div>

        <Card className="bg-white/5 border-white/10 text-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-teal-400" />
              {invite.orgName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-white/70">
            <div className="flex justify-between">
              <span>App access</span>
              <span className="text-white capitalize">{invite.brand === "dual" ? "Both Apps" : invite.brand === "aaus" ? "UltrasoundAssist™" : "EchoAssist™"}</span>
            </div>
            <div className="flex justify-between">
              <span>Plan</span>
              <span className="text-white capitalize">{invite.plan}</span>
            </div>
            <div className="flex justify-between">
              <span>Invited email</span>
              <span className="text-white">{invite.inviteEmail}</span>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <Button
          onClick={handleAccept}
          disabled={acceptMutation.isPending}
          className="w-full bg-teal-500 hover:bg-teal-400 text-white font-semibold"
          size="lg"
        >
          {acceptMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Accepting…</>
          ) : !user ? (
            "Sign in to accept invitation"
          ) : (
            "Accept invitation & activate access"
          )}
        </Button>

        {!user && (
          <p className="text-center text-xs text-white/40">
            You'll be redirected to sign in, then returned here automatically.
          </p>
        )}
      </div>
    </div>
  );
}
