/**
 * CommunityProfile.tsx
 * Member profile page: XP, level, badges, recent posts, follow/unfollow.
 */
import { useEffect } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  UserPlus, UserMinus, MapPin, Globe, Calendar, MessageSquare,
  Star, Flame, Award, Users, ChevronLeft
} from "lucide-react";

function XPBar({ xp }: { xp: any }) {
  if (!xp) return null;
  const levelXP = Math.pow((xp.level - 1) * 5, 2);
  const nextLevelXP = Math.pow(xp.level * 5, 2);
  const progress = Math.min(100, ((xp.totalXP - levelXP) / (nextLevelXP - levelXP)) * 100);
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>Level {xp.level}</span>
        <span>{xp.totalXP.toLocaleString()} XP</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-teal-500 to-teal-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-1">{(nextLevelXP - xp.totalXP).toLocaleString()} XP to Level {xp.level + 1}</p>
    </div>
  );
}

export default function CommunityProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();

  const { data: profile, isLoading } = trpc.community.member.getMemberProfile.useQuery(
    { userId: parseInt(userId!) },
    { enabled: !!userId }
  );

  const followMutation = trpc.community.member.toggleFollow.useMutation({
    onSuccess: (data) => {
      toast.success(data.following ? "Following!" : "Unfollowed");
      utils.community.member.getMemberProfile.invalidate({ userId: parseInt(userId!) });
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (profile) document.title = `${profile.displayName || profile.name} | Community | All About Ultrasound™`;
    return () => { document.title = "All About Ultrasound™"; };
  }, [profile]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Skeleton className="h-48 rounded-xl mb-6" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Member not found</h2>
          <Link href="/community"><Button variant="outline">Back to Community</Button></Link>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;
  const displayName = profile.displayName || profile.name;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back link */}
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <Link href="/community">
          <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-teal-600 transition-colors mb-4">
            <ChevronLeft className="w-4 h-4" />Back to Community
          </button>
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-12">
        {/* Profile card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-5">
              <Avatar className="w-20 h-20">
                <AvatarImage src={profile.avatarUrl ?? undefined} />
                <AvatarFallback className="text-2xl bg-teal-100 text-teal-700 font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
                    {profile.credentials && <p className="text-teal-600 font-medium text-sm">{profile.credentials}</p>}
                    {profile.specialty && <p className="text-gray-500 text-sm">{profile.specialty}</p>}
                  </div>
                  {!isOwnProfile && currentUser && (
                    <Button
                      size="sm"
                      variant={profile.isFollowing ? "outline" : "default"}
                      className={profile.isFollowing ? "" : "bg-teal-600 hover:bg-teal-700 text-white"}
                      onClick={() => followMutation.mutate({ targetUserId: profile.id })}
                      disabled={followMutation.isPending}
                    >
                      {profile.isFollowing
                        ? <><UserMinus className="w-4 h-4 mr-1" />Unfollow</>
                        : <><UserPlus className="w-4 h-4 mr-1" />Follow</>
                      }
                    </Button>
                  )}
                </div>

                {profile.bio && <p className="text-gray-600 text-sm mt-2">{profile.bio}</p>}

                <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                  {profile.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{profile.location}</span>}
                  {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-teal-600 hover:underline"><Globe className="w-3.5 h-3.5" />Website</a>}
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Joined {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                </div>

                <div className="flex gap-6 mt-3 text-sm">
                  <span><strong className="text-gray-900">{(profile.followersCount ?? 0).toLocaleString()}</strong> <span className="text-gray-500">followers</span></span>
                  <span><strong className="text-gray-900">{(profile.followingCount ?? 0).toLocaleString()}</strong> <span className="text-gray-500">following</span></span>
                </div>
              </div>
            </div>

            {/* XP bar */}
            {profile.xp && <XPBar xp={profile.xp} />}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Badges */}
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />Badges
              </h2>
              {profile.badges?.length === 0 ? (
                <p className="text-sm text-gray-400">No badges earned yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {profile.badges?.map((badge: any) => (
                    <div key={badge.id} title={badge.description ?? ""} className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-3 py-1 text-sm">
                      <span>{badge.iconEmoji}</span>
                      <span className="font-medium">{badge.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-teal-500" />Activity
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-2xl font-bold text-teal-600">{profile.xp?.postsCount ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Posts</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-2xl font-bold text-teal-600">{profile.xp?.commentsCount ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Comments</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-2xl font-bold text-amber-500">{profile.xp?.streakDays ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Day Streak 🔥</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-2xl font-bold text-teal-600">{profile.xp?.level ?? 1}</p>
                  <p className="text-xs text-gray-500 mt-1">Level</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent posts */}
        {profile.recentPosts?.length > 0 && (
          <Card className="mt-6">
            <CardContent className="p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-500" />Recent Posts
              </h2>
              <div className="space-y-3">
                {profile.recentPosts.map((post: any) => (
                  <div key={post.id} className="border-b last:border-0 pb-3 last:pb-0">
                    {post.title && <p className="font-medium text-gray-900 text-sm">{post.title}</p>}
                    <p className="text-sm text-gray-600 line-clamp-2">{post.body}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      <span><MessageSquare className="w-3 h-3 inline mr-0.5" />{post.commentCount ?? 0}</span>
                      <span>❤️ {post.reactionCount ?? 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
