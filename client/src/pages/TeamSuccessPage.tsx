/**
 * TeamSuccessPage — /team/success
 * Shown after a successful team subscription checkout.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Users, ArrowRight, Loader2 } from "lucide-react";

export default function TeamSuccessPage() {
  const [, navigate] = useLocation();

  // Poll for team subscription to appear (webhook may take a moment)
  const myTeamsQuery = trpc.team.getMyTeams.useQuery(undefined, {
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
  });

  const firstTeam = myTeamsQuery.data?.[0];
  const hasTeam = !!firstTeam;

  useEffect(() => {
    // Auto-navigate to team dashboard once webhook fulfills the subscription
    if (firstTeam) {
      const timer = setTimeout(() => navigate(`/team/${firstTeam.id}`), 1500);
      return () => clearTimeout(timer);
    }
  }, [firstTeam?.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-teal-400" />
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-2">Payment confirmed!</h1>
          <p className="text-white/60">
            Your team subscription is being set up. This usually takes a few seconds.
          </p>
        </div>

        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="pt-6 pb-4 space-y-3">
            {myTeamsQuery.isLoading || !hasTeam ? (
              <div className="flex items-center justify-center gap-2 text-white/60 py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Setting up your team…</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-teal-400 justify-center">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Team subscription active</span>
                </div>
                <p className="text-sm text-white/60">
                  Head to your team dashboard to invite members and manage seats.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => firstTeam ? navigate(`/team/${firstTeam.id}`) : undefined}
            disabled={!hasTeam}
            className="bg-teal-500 hover:bg-teal-400 text-white font-semibold"
            size="lg"
          >
            <Users className="h-4 w-4 mr-2" />
            Go to Team Dashboard
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-white/60 hover:text-white"
          >
            Return to home
          </Button>
        </div>
      </div>
    </div>
  );
}
