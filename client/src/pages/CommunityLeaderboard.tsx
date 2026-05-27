/**
 * CommunityLeaderboard.tsx
 * Full XP leaderboard with badges and stats.
 */
import { useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Trophy, Star, Flame, MessageSquare } from "lucide-react";

const RANK_COLORS = ["text-amber-500", "text-gray-400", "text-amber-700"];
const RANK_ICONS = ["🥇", "🥈", "🥉"];

export default function CommunityLeaderboard() {
  const { data: leaderboard, isLoading } = trpc.community.public.leaderboard.useQuery({ limit: 50 });
  const { user } = useAuth();

  useEffect(() => {
    document.title = "Leaderboard | Community | All About Ultrasound™";
    return () => { document.title = "All About Ultrasound™"; };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link href="/community">
          <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-teal-600 mb-4">
            <ChevronLeft className="w-4 h-4" />Community
          </button>
        </Link>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-amber-500" />
            <h1 className="text-3xl font-bold text-gray-900">Leaderboard</h1>
          </div>
          <p className="text-gray-500">Top community contributors ranked by XP</p>
        </div>

        {/* Top 3 podium */}
        {!isLoading && leaderboard && leaderboard.length >= 3 && (
          <div className="flex items-end justify-center gap-4 mb-8">
            {/* 2nd */}
            <div className="text-center">
              <Avatar className="w-14 h-14 mx-auto mb-2 ring-2 ring-gray-300">
                <AvatarImage src={leaderboard[1].user?.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-gray-100 text-gray-600 font-bold">
                  {(leaderboard[1].user?.displayName || leaderboard[1].user?.name || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-2xl mb-1">🥈</div>
              <p className="text-sm font-semibold text-gray-900 truncate max-w-[80px]">{leaderboard[1].user?.displayName || leaderboard[1].user?.name}</p>
              <p className="text-xs text-gray-500">{leaderboard[1].totalXP.toLocaleString()} XP</p>
              <div className="bg-gray-200 h-16 rounded-t-lg mt-2 w-20 mx-auto" />
            </div>
            {/* 1st */}
            <div className="text-center -mt-4">
              <Avatar className="w-18 h-18 mx-auto mb-2 ring-4 ring-amber-400" style={{ width: 72, height: 72 }}>
                <AvatarImage src={leaderboard[0].user?.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-amber-100 text-amber-700 font-bold text-xl">
                  {(leaderboard[0].user?.displayName || leaderboard[0].user?.name || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-3xl mb-1">🥇</div>
              <p className="text-sm font-bold text-gray-900 truncate max-w-[80px]">{leaderboard[0].user?.displayName || leaderboard[0].user?.name}</p>
              <p className="text-xs text-amber-600 font-semibold">{leaderboard[0].totalXP.toLocaleString()} XP</p>
              <div className="bg-amber-400 h-24 rounded-t-lg mt-2 w-20 mx-auto" />
            </div>
            {/* 3rd */}
            <div className="text-center">
              <Avatar className="w-14 h-14 mx-auto mb-2 ring-2 ring-amber-700/40">
                <AvatarImage src={leaderboard[2].user?.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-amber-50 text-amber-700 font-bold">
                  {(leaderboard[2].user?.displayName || leaderboard[2].user?.name || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-2xl mb-1">🥉</div>
              <p className="text-sm font-semibold text-gray-900 truncate max-w-[80px]">{leaderboard[2].user?.displayName || leaderboard[2].user?.name}</p>
              <p className="text-xs text-gray-500">{leaderboard[2].totalXP.toLocaleString()} XP</p>
              <div className="bg-amber-700/30 h-10 rounded-t-lg mt-2 w-20 mx-auto" />
            </div>
          </div>
        )}

        {/* Full list */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : !leaderboard?.length ? (
              <div className="p-12 text-center text-gray-400">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No members on the leaderboard yet. Start contributing!</p>
              </div>
            ) : (
              leaderboard.map((entry, i) => {
                const isCurrentUser = user?.id === entry.userId;
                return (
                  <Link key={entry.userId} href={`/community/profile/${entry.userId}`}>
                    <div className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors border-b last:border-0 cursor-pointer ${isCurrentUser ? "bg-teal-50" : ""}`}>
                      <span className={`w-8 text-center font-bold text-lg ${RANK_COLORS[i] || "text-gray-500"}`}>
                        {i < 3 ? RANK_ICONS[i] : `#${entry.rank}`}
                      </span>
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={entry.user?.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-sm bg-teal-100 text-teal-700 font-semibold">
                          {(entry.user?.displayName || entry.user?.name || "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 text-sm truncate">{entry.user?.displayName || entry.user?.name}</p>
                          {entry.user?.credentials && <span className="text-xs text-teal-600">{entry.user.credentials}</span>}
                          {isCurrentUser && <Badge className="text-xs bg-teal-100 text-teal-700 border-teal-200">You</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                          <span>Level {entry.level}</span>
                          <span><MessageSquare className="w-3 h-3 inline mr-0.5" />{entry.postsCount}</span>
                          {entry.streakDays >= 7 && <span><Flame className="w-3 h-3 inline text-orange-400 mr-0.5" />{entry.streakDays}d</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-teal-600 text-sm">{entry.totalXP.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">XP</p>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* XP guide */}
        <Card className="mt-6">
          <CardContent className="p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-teal-500" />How to Earn XP</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ["Post a discussion", "+10 XP"],
                ["Add a comment", "+5 XP"],
                ["React to a post", "+2 XP"],
                ["Vote on a poll", "+3 XP"],
                ["Follow a member", "+2 XP"],
                ["Join a community", "+5 XP"],
              ].map(([action, xp]) => (
                <div key={action} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-600">{action}</span>
                  <span className="font-semibold text-teal-600">{xp}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
