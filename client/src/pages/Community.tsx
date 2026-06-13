/**
 * Community.tsx
 * Main community hub — shows community list and redirects to the first/default community feed.
 */
import { useState, useEffect, useRef } from "react";
import { useSeoHead } from "@/hooks/useSeoHead";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, MessageSquare, TrendingUp, ChevronRight, Lock, Star, ArrowRight, BookOpen, Mail } from "lucide-react";

export default function CommunityHub() {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const { data: communities, isLoading } = trpc.community.public.listCommunities.useQuery();
  const { data: trending } = trpc.community.public.trendingHashtags.useQuery();
  const { data: leaderboard } = trpc.community.public.leaderboard.useQuery({ limit: 5 });

  useSeoHead({
    title: "Community | All About Ultrasound™",
    description: "Join the All About Ultrasound community. Connect with sonographers, share cases, and grow your skills together.",
    canonical: typeof window !== "undefined" ? `${window.location.origin}/community` : undefined,
    type: "website",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-teal-600 to-teal-800 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Users className="w-10 h-10 opacity-90" />
            <h1 className="text-4xl font-bold">Community</h1>
          </div>
          <p className="text-teal-100 text-lg max-w-2xl mx-auto">
            Connect with sonographers, physicians, and educators. Share cases, ask questions, and grow together.
          </p>
          {!isAuthenticated && (
            <div className="mt-6">
              <a href={getLoginUrl("/community")}>
                <Button size="lg" className="bg-white text-teal-700 hover:bg-teal-50 font-semibold">
                  Sign In to Join
                </Button>
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Communities list */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold text-gray-900 mb-5">Spaces</h2>
          {!communities?.length ? (
            <Card>
              <CardContent className="py-16 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No communities yet. Check back soon!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {communities.map((c) => {
                const isLocked = (c.accessType === "invite_only" || c.accessType === "course_gated") && !isAuthenticated;
                const CardWrapper = isLocked ? "div" : Link;
                const cardProps = isLocked ? {} : { href: `/community/${c.slug}` };
                return (
                  <CardWrapper key={c.id} {...(cardProps as any)}>
                    <Card className={`transition-shadow ${isLocked ? "opacity-80" : "hover:shadow-md cursor-pointer group"}`}>
                      <CardContent className="p-0">
                        {c.coverImage && (
                          <div className="h-24 rounded-t-xl overflow-hidden">
                            <img src={c.coverImage} alt={c.title} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="p-5 flex items-start gap-4">
                          {c.logoImage ? (
                            <img src={c.logoImage} alt={c.title} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-lg"
                              style={{ backgroundColor: c.accentColor || "#189aa1" }}>
                              {c.title.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-gray-900 group-hover:text-teal-600 transition-colors">{c.title}</h3>
                              {c.accessType === "invite_only" && (
                                <Badge variant="secondary" className="text-xs"><Mail className="w-3 h-3 mr-1" />Invite Only</Badge>
                              )}
                              {c.accessType === "course_gated" && (
                                <Badge className="text-xs bg-blue-50 text-blue-700 border-blue-200"><BookOpen className="w-3 h-3 mr-1" />Course Access</Badge>
                              )}
                              {c.privacy === "private" && c.accessType !== "invite_only" && c.accessType !== "course_gated" && (
                                <Badge variant="secondary" className="text-xs"><Lock className="w-3 h-3 mr-1" />Private</Badge>
                              )}
                              {c.accessType === "paid" && <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">Premium</Badge>}
                              {c.brand === "iheartecho" && <Badge variant="outline" className="text-xs text-pink-600 border-pink-200">iHeartEcho™</Badge>}
                            </div>
                            {c.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{c.description}</p>}
                            {c.accessType === "invite_only" && !isAuthenticated && (
                              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Lock className="w-3 h-3" /> Requires an invite link to join</p>
                            )}
                            {c.accessType === "course_gated" && !isAuthenticated && (
                              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><BookOpen className="w-3 h-3" /> Enroll in a linked course to access</p>
                            )}
                          </div>
                          {isLocked ? (
                            <Lock className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-teal-500 flex-shrink-0 mt-1" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </CardWrapper>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Trending hashtags */}
          {trending && trending.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-teal-600" />
                  <h3 className="font-semibold text-gray-900">Trending Topics</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {trending.slice(0, 12).map((t) => (
                    <span key={t.id} className="text-sm bg-teal-50 text-teal-700 px-2 py-1 rounded-full cursor-pointer hover:bg-teal-100 transition-colors">
                      #{t.tag} <span className="text-teal-400 text-xs">{t.postCount}</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Leaderboard */}
          {leaderboard && leaderboard.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold text-gray-900">Top Members</h3>
                </div>
                <div className="space-y-3">
                  {leaderboard.map((entry) => (
                    <div key={entry.userId} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 w-5 text-center">#{entry.rank}</span>
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={entry.user?.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-xs bg-teal-100 text-teal-700">
                          {(entry.user?.displayName || entry.user?.name || "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{entry.user?.displayName || entry.user?.name}</p>
                        <p className="text-xs text-gray-400">{entry.totalXP.toLocaleString()} XP · Level {entry.level}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Link href="/community/leaderboard">
                  <Button variant="ghost" size="sm" className="w-full mt-3 text-teal-600 hover:text-teal-700">
                    View Full Leaderboard <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
