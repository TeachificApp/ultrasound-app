import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Medal, Trophy } from "lucide-react";

export default function Leaderboard() {
  const { user } = useAuth();
  const leaderboardQuery = trpc.leaderboard.list.useQuery();
  const entries = leaderboardQuery.data ?? [];

  const medalColors = ["text-yellow-500", "text-gray-400", "text-amber-600"];

  return (
    <div className="min-h-screen bg-background">
      <div className="aaus-gradient px-4 py-4 text-white">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="flex items-center gap-1 text-white/80 text-sm mb-2 hover:text-white">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Trophy size={18} />
            <h1 className="text-lg font-bold" style={{ fontFamily: "Merriweather, serif" }}>Leaderboard</h1>
          </div>
          <p className="text-white/80 text-xs mt-0.5">Top performers in Daily Challenges</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy size={14} className="text-yellow-500" />
              Top 20 — This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {leaderboardQuery.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No entries yet. Be the first to complete a Daily Challenge!
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map((entry: any, idx: number) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center gap-3 p-2.5 rounded-lg ${
                      entry.userId === user?.id ? "bg-primary/10 border border-primary/30" : "bg-muted/40"
                    }`}
                  >
                    <div className="w-7 text-center flex-shrink-0">
                      {idx < 3 ? (
                        <Medal size={18} className={medalColors[idx]} />
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground">{idx + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {entry.name ?? "Anonymous"}
                        {entry.userId === user?.id && (
                          <Badge variant="outline" className="ml-1.5 text-[10px]">You</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold">{entry.score}</div>
                      <div className="text-[10px] text-muted-foreground">points</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-amber-500">{entry.streak ?? 0}</div>
                      <div className="text-[10px] text-muted-foreground">streak</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
