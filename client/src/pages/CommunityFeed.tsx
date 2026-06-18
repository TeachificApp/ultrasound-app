/**
 * CommunityFeed.tsx
 * The main community space view: channel sidebar, post feed, post creation,
 * reactions, comments, and a collapsible members sidebar with DM buttons.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import RichTextEditor, { RichTextDisplay } from "@/components/RichTextEditor";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { isRichTextEmpty, appendHashtagsToBody } from "@shared/communityText";
import { publicMemberDisplayName } from "@shared/communityMember";
import { isCommunityPlatformAdmin } from "@/lib/communityAccess";
import {
  MessageSquare, Heart, Bookmark, BookmarkCheck, MoreHorizontal,
  Image as ImageIcon, BarChart2, Send, ChevronDown, ChevronUp,
  Pin, Lock, EyeOff, Flag, Trash2, Edit2, Hash, Plus, Users, X,
  ThumbsUp, Smile, Star, Flame, Mail, ChevronRight, ChevronLeft,
  UserCircle, Search
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { BlockPreview, type Block } from "@/components/BlockPreview";
import { RelatedProductsBlock } from "@/components/RelatedProductsBlock";

const REACTIONS = ["❤️", "👍", "🔥", "⭐", "🎉", "🤔", "💡", "👏"];

function timeAgo(dateStr: string | Date) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

function AuthorAvatar({ author, size = "sm" }: { author: any; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const name = publicMemberDisplayName(author ?? {});
  return (
    <Avatar className={sz}>
      <AvatarImage src={author?.avatarUrl ?? undefined} />
      <AvatarFallback className="text-xs bg-teal-100 text-teal-700 font-semibold">
        {name.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

function ReactionBar({ post, onReact }: { post: any; onReact: (emoji: string) => void }) {
  const [showPicker, setShowPicker] = useState(false);
  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={() => setShowPicker(p => !p)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm transition-colors ${
          post.myReaction ? "bg-teal-50 text-teal-600 border border-teal-200" : "text-gray-500 hover:bg-gray-100"
        }`}
      >
        {post.myReaction ? <span>{post.myReaction}</span> : <Smile className="w-4 h-4" />}
        <span>{post.reactionCount || 0}</span>
      </button>
      {showPicker && (
        <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg p-2 flex gap-1 z-20">
          {REACTIONS.map(emoji => (
            <button
              key={emoji}
              onClick={() => { onReact(emoji); setShowPicker(false); }}
              className={`text-xl hover:scale-125 transition-transform p-1 rounded ${post.myReaction === emoji ? "bg-teal-50" : ""}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentThread({ postId, isOpen, onClose }: { postId: number; isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [selectedAliasId, setSelectedAliasId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { data: post, isLoading } = trpc.community.member.getPost.useQuery(
    { postId },
    { enabled: isOpen }
  );
  const { data: aliases } = trpc.admin.listPostingAliases.useQuery(undefined, {
    enabled: isOpen && user?.role === "admin",
  });
  const addComment = trpc.community.member.addComment.useMutation({
    onSuccess: () => {
      setBody("");
      utils.community.member.getPost.invalidate({ postId });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isOpen) return null;
  return (
    <div className="mt-4 border-t pt-4">
      {isLoading ? (
        <div className="space-y-3">
          {[1,2].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {post?.comments?.map((c: any) => {
            const displayName = c.aliasName || publicMemberDisplayName(c.author ?? {});
            const displayAvatar = c.aliasAvatarUrl || c.author?.avatarUrl;
            return (
              <div key={c.id} className={`flex gap-3 ${c.parentId ? "ml-8" : ""}`}>
                <AuthorAvatar author={{ name: displayName, avatarUrl: displayAvatar }} />
                <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">{displayName}</span>
                    {!c.aliasName && c.author?.credentials && <span className="text-xs text-teal-600 font-medium">{c.author.credentials}</span>}
                    {c.aliasName && <span className="text-xs text-purple-500 font-medium">alias</span>}
                    <span className="text-xs text-gray-400 ml-auto">{timeAgo(c.createdAt)}</span>
                  </div>
                  {c.body && (c.body.startsWith('<') ? <RichTextDisplay content={c.body} className="text-sm text-gray-700" /> : <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>)}
                </div>
              </div>
            );
          })}
          {(!post?.comments || post.comments.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-4">No comments yet. Be the first!</p>
          )}
        </div>
      )}
      {user && (
        <div className="flex gap-3 mt-4">
          <AuthorAvatar
            author={selectedAliasId && aliases?.find((a: any) => a.id === selectedAliasId)
              ? { name: aliases.find((a: any) => a.id === selectedAliasId)!.name, avatarUrl: aliases.find((a: any) => a.id === selectedAliasId)!.avatarUrl ?? undefined }
              : user}
          />
          <div className="flex-1 space-y-2">
            {user?.role === "admin" && aliases && aliases.length > 0 && (
              <Select
                value={selectedAliasId === null ? "self" : String(selectedAliasId)}
                onValueChange={v => setSelectedAliasId(v === "self" ? null : Number(v))}
              >
                <SelectTrigger className="h-7 text-xs w-44">
                  <SelectValue placeholder="Post as..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Post as myself</SelectItem>
                  {aliases.map((a: any) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2">
              <RichTextEditor
                value={body}
                onChange={setBody}
                placeholder="Add a comment…"
                minHeight={60}
              />
              <Button
                size="sm"
                className="self-end bg-teal-600 hover:bg-teal-700"
                disabled={!body || addComment.isPending}
                onClick={() => addComment.mutate({ postId, body, aliasId: selectedAliasId ?? undefined })}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PostCard({ post, isAdmin, communityId }: { post: any; isAdmin: boolean; communityId: number }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const utils = trpc.useUtils();
  const { user } = useAuth();

  const reactMutation = trpc.community.member.reactToPost.useMutation({
    onSuccess: () => utils.community.member.getFeed.invalidate({ communityId }),
    onError: (e) => toast.error(e.message),
  });
  const bookmarkMutation = trpc.community.member.toggleBookmark.useMutation({
    onSuccess: () => utils.community.member.getFeed.invalidate({ communityId }),
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.community.member.deletePost.useMutation({
    onSuccess: () => {
      toast.success("Post deleted");
      utils.community.member.getFeed.invalidate({ communityId });
    },
    onError: (e) => toast.error(e.message),
  });
  const pinMutation = trpc.community.admin.togglePinPost.useMutation({
    onSuccess: () => utils.community.member.getFeed.invalidate({ communityId }),
  });
  const hideMutation = trpc.community.admin.toggleHidePost.useMutation({
    onSuccess: () => utils.community.member.getFeed.invalidate({ communityId }),
  });
  const lockMutation = trpc.community.admin.toggleLockPost.useMutation({
    onSuccess: () => utils.community.member.getFeed.invalidate({ communityId }),
  });
  const reportMutation = trpc.community.member.reportContent.useMutation({
    onSuccess: () => toast.success("Report submitted. Thank you."),
    onError: (e) => toast.error(e.message),
  });

  const attachments = post.attachments ? JSON.parse(post.attachments) : [];

  return (
    <Card className={`${post.isPinned ? "border-teal-300 bg-teal-50/30" : ""} ${post.isLocked ? "opacity-80" : ""}`}>
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <Link href={post.author?.id ? `/community/members/${post.author.id}` : "#"}>
            <AuthorAvatar author={post.author} size="md" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={post.author?.id ? `/community/members/${post.author.id}` : "#"}>
                <span className="font-semibold text-gray-900 text-sm hover:text-teal-600 cursor-pointer transition-colors">{publicMemberDisplayName(post.author ?? {})}</span>
              </Link>
              {post.author?.communityRole === "admin" && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-600 text-white">Admin</span>
              )}
              {post.author?.communityRole === "moderator" && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 text-white">Mod</span>
              )}
              {post.author?.credentials && <span className="text-xs text-teal-600 font-medium">{post.author.credentials}</span>}
              {post.author?.specialty && <span className="text-xs text-gray-400">{post.author.specialty}</span>}
              <span className="text-xs text-gray-400 ml-auto">{timeAgo(post.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {post.isPinned && <Badge variant="outline" className="text-xs text-teal-600 border-teal-200 py-0"><Pin className="w-2.5 h-2.5 mr-1" />Pinned</Badge>}
              {post.isLocked && <Badge variant="outline" className="text-xs text-gray-500 py-0"><Lock className="w-2.5 h-2.5 mr-1" />Locked</Badge>}
              {post.postType !== "text" && <Badge variant="secondary" className="text-xs py-0 capitalize">{post.postType}</Badge>}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-400 hover:text-gray-600">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(user?.id === post.userId || isAdmin) && (
                <DropdownMenuItem className="text-red-600" onClick={() => deleteMutation.mutate({ postId: post.id })}>
                  <Trash2 className="w-4 h-4 mr-2" />Delete
                </DropdownMenuItem>
              )}
              {isAdmin && <>
                <DropdownMenuItem onClick={() => pinMutation.mutate({ postId: post.id })}>
                  <Pin className="w-4 h-4 mr-2" />{post.isPinned ? "Unpin" : "Pin"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => lockMutation.mutate({ postId: post.id })}>
                  <Lock className="w-4 h-4 mr-2" />{post.isLocked ? "Unlock" : "Lock"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => hideMutation.mutate({ postId: post.id })}>
                  <EyeOff className="w-4 h-4 mr-2" />{post.isHidden ? "Unhide" : "Hide"}
                </DropdownMenuItem>
              </>}
              {user?.id !== post.userId && (
                <DropdownMenuItem onClick={() => reportMutation.mutate({ targetType: "post", targetId: post.id, reason: "Inappropriate content", communityId })}>
                  <Flag className="w-4 h-4 mr-2" />Report
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        {post.title && <h3 className="font-semibold text-gray-900 mb-2">{post.title}</h3>}
        {post.body && (post.body.startsWith('<') ? <RichTextDisplay content={post.body} className="text-gray-700 text-sm leading-relaxed" /> : <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">{post.body}</p>)}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {attachments.filter((a: any) => a.type?.startsWith("image")).map((a: any, i: number) => (
              <img key={i} src={a.url} alt="" className="rounded-lg object-cover w-full h-40" />
            ))}
          </div>
        )}

        {/* Hashtags */}
        {post.hashtags && (
          <div className="flex flex-wrap gap-1 mt-3">
            {(post.hashtags as string).split(",").filter(Boolean).map((tag: string) => (
              <span key={tag} className="text-xs text-teal-600 hover:underline cursor-pointer">#{tag.trim()}</span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
          <ReactionBar post={post} onReact={(emoji) => reactMutation.mutate({ postId: post.id, emoji })} />
          <button
            onClick={() => setCommentsOpen(o => !o)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm transition-colors ${
              commentsOpen ? "bg-teal-50 text-teal-600 border border-teal-200" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{post.commentCount || 0}</span>
          </button>
          <button
            onClick={() => bookmarkMutation.mutate({ postId: post.id })}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm transition-colors ${
              post.isBookmarked ? "bg-amber-50 text-amber-600 border border-amber-200" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {post.isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </button>
        </div>

        {/* Comments */}
        <CommentThread postId={post.id} isOpen={commentsOpen} onClose={() => setCommentsOpen(false)} />
      </CardContent>
    </Card>
  );
}

// ─── Create Post Box ──────────────────────────────────────────────────────────
function CreatePostBox({ communityId, channelId, onPosted }: { communityId: number; channelId: number; onPosted: () => void }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [selectedAliasId, setSelectedAliasId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { data: aliases } = trpc.admin.listPostingAliases.useQuery(undefined, { enabled: user?.role === "admin" });
  const createPost = trpc.community.member.createPost.useMutation({
    onSuccess: async () => {
      setTitle("");
      setBody("");
      setHashtags("");
      setExpanded(false);
      setSelectedAliasId(null);
      await utils.community.member.getFeed.reset();
      await utils.community.member.getFeed.invalidate({ communityId, channelId });
      toast.success("Your post was published");
      onPosted();
    },
    onError: (e) => toast.error(e.message),
  });
  if (!user) return null;

  const submitPost = () => {
    const finalBody = appendHashtagsToBody(body, hashtags);
    if (isRichTextEmpty(finalBody)) {
      toast.error("Please write something before posting");
      return;
    }
    createPost.mutate({
      communityId,
      channelId,
      title: title.trim() || undefined,
      body: finalBody,
      aliasId: selectedAliasId ?? undefined,
    });
  };

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        {!expanded ? (
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(true)}>
            <AuthorAvatar author={user} />
            <div className="flex-1 bg-gray-100 hover:bg-gray-200 rounded-full px-4 py-2.5 text-sm text-gray-500 transition-colors">
              Share something with the community…
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {user?.role === "admin" && aliases && aliases.length > 0 && (
              <Select
                value={selectedAliasId === null ? "self" : String(selectedAliasId)}
                onValueChange={v => setSelectedAliasId(v === "self" ? null : Number(v))}
              >
                <SelectTrigger className="h-8 text-xs w-48">
                  <SelectValue placeholder="Post as..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Post as myself</SelectItem>
                  {aliases.map((a: any) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Post title (optional)"
              className="font-medium"
            />
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="What's on your mind?"
              minHeight={120}
            />
            <Input
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
              placeholder="#hashtags (comma-separated)"
              className="text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setExpanded(false); setTitle(""); setBody(""); setHashtags(""); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={isRichTextEmpty(body) || createPost.isPending}
                onClick={submitPost}
              >
                <Send className="w-4 h-4 mr-1" />Post
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Members Sidebar ──────────────────────────────────────────────────────────
function MembersSidebar({ communityId, currentUserId }: { communityId: number; currentUserId?: number }) {
  const [search, setSearch] = useState("");
  const { data: members, isLoading } = trpc.community.member.getRecentMembers.useQuery(
    { communityId, limit: 40 },
    { enabled: !!communityId }
  );

  const filtered = (members ?? []).filter((m: any) => {
    if (!search) return true;
    const name = publicMemberDisplayName(m).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="h-full flex flex-col min-h-[320px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Members</h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{members?.length ?? 0}</span>
      </div>

      {/* Avatar strip — top 8 members */}
      {!search && (members?.length ?? 0) > 0 && (
        <div className="flex -space-x-2 mb-4">
          {(members ?? []).slice(0, 8).map((m: any) => (
            <Link key={m.userId} href={`/community/members/${m.userId}`}>
              <Avatar className="w-9 h-9 border-2 border-white cursor-pointer hover:z-10 hover:scale-110 transition-transform">
                <AvatarImage src={m.avatarUrl ?? undefined} />
                <AvatarFallback className="text-xs bg-teal-100 text-teal-700 font-bold">
                  {publicMemberDisplayName(m).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
          ))}
          {(members?.length ?? 0) > 8 && (
            <div className="w-9 h-9 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-semibold">
              +{(members?.length ?? 0) - 8}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search members..."
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 pr-1">
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{search ? "No members found" : "No members yet"}</p>
        ) : (
          filtered.map((m: any) => {
            const label = publicMemberDisplayName(m);
            return (
            <div key={m.userId} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 group">
              <Link href={`/community/members/${m.userId}`} className="flex items-center gap-2.5 flex-1 min-w-0">
                <Avatar className="w-9 h-9 flex-shrink-0">
                  <AvatarImage src={m.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs bg-teal-100 text-teal-700 font-semibold">
                    {label.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{label}</p>
                  {m.credentials && <p className="text-xs text-teal-600 truncate">{m.credentials}</p>}
                </div>
              </Link>
              {currentUserId && m.userId !== currentUserId && (
                <Link href={`/community/dms/${m.userId}`}>
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-teal-50 text-teal-600" title={`Message ${label}`}>
                    <Mail className="w-4 h-4" />
                  </button>
                </Link>
              )}
              {m.role === "admin" && (
                <span className="text-[10px] font-bold bg-teal-600 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">A</span>
              )}
              {m.role === "moderator" && (
                <span className="text-[10px] font-bold bg-purple-600 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">M</span>
              )}
            </div>
          );})
        )}
      </div>
    </div>
  );
}

// ─── Channel Header with Avatar Strip ────────────────────────────────────────
function ChannelHeader({
  channel, community, memberCount, recentMembers, showMembersSidebar, onToggleSidebar
}: {
  channel: any; community: any; memberCount: number;
  recentMembers: any[]; showMembersSidebar: boolean; onToggleSidebar: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4 pb-3 border-b">
      <div className="flex items-center gap-2 min-w-0">
        <Hash className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <h2 className="font-semibold text-gray-900 truncate">{channel?.name ?? "All Posts"}</h2>
        {channel?.description && (
          <span className="text-xs text-gray-400 hidden sm:block truncate">— {channel.description}</span>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Overlapping member avatars */}
        {recentMembers.length > 0 && (
          <div className="flex -space-x-1.5 items-center">
            {recentMembers.slice(0, 5).map((m: any) => (
              <Avatar key={m.userId} className="w-6 h-6 border-2 border-white">
                <AvatarImage src={m.avatarUrl ?? undefined} />
                <AvatarFallback className="text-[9px] bg-teal-100 text-teal-700 font-bold">
                  {publicMemberDisplayName(m).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            <span className="text-xs text-gray-500 ml-2 font-medium">{memberCount.toLocaleString()}</span>
          </div>
        )}
        {/* Toggle members sidebar */}
        <button
          onClick={onToggleSidebar}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full transition-colors ${
            showMembersSidebar ? "bg-teal-50 text-teal-600 border border-teal-200" : "text-gray-500 hover:bg-gray-100"
          }`}
          title={showMembersSidebar ? "Hide members" : "Show members"}
        >
          <Users className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Members</span>
          {showMembersSidebar ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const RESERVED_COMMUNITY_SLUGS: Record<string, string> = {
  leaderboard: "/community/leaderboard",
  dms: "/community/dms",
};

function CommunityPageBlocks({ blocksJson }: { blocksJson?: string | null }) {
  const blocks: Block[] = useMemo(() => {
    if (!blocksJson) return [];
    try {
      const parsed = JSON.parse(blocksJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [blocksJson]);

  if (!blocks.length) return null;

  return (
    <div className="mb-6 space-y-0">
      {blocks.map((block: any) => {
        if (block.type === "related_products") {
          return <RelatedProductsBlock key={block.id} data={block.data ?? {}} />;
        }
        return <BlockPreview key={block.id} block={block} />;
      })}
    </div>
  );
}

export default function CommunityFeed() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [sort, setSort] = useState<"newest" | "trending">("newest");
  const [showMembersSidebar, setShowMembersSidebar] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const redirect = RESERVED_COMMUNITY_SLUGS[slug.toLowerCase()];
    if (redirect) navigate(redirect, { replace: true });
  }, [slug, navigate]);

  const { data: community, isLoading: communityLoading } = trpc.community.public.getCommunity.useQuery(
    { slug: slug! },
    { enabled: !!slug && !RESERVED_COMMUNITY_SLUGS[slug.toLowerCase()] }
  );
  const { data: membership } = trpc.community.member.myMembership.useQuery(
    { communityId: community?.id ?? 0 },
    { enabled: !!community?.id && isAuthenticated }
  );

  const joinMutation = trpc.community.member.join.useMutation({
    onSuccess: () => {
      toast.success(`Joined ${community?.title}!`);
      utils.community.member.myMembership.invalidate({ communityId: community?.id });
    },
    onError: (e) => toast.error(e.message),
  });

  const utils = trpc.useUtils();
  const isAdmin = isCommunityPlatformAdmin(user);
  const isMember = !!membership || isAdmin;

  // Recent members for sidebar and avatar strip
  const { data: recentMembers } = trpc.community.member.getRecentMembers.useQuery(
    { communityId: community?.id ?? 0, limit: 40 },
    { enabled: !!community?.id && isMember }
  );

  // Set default channel
  useEffect(() => {
    if (community?.channels?.length && !activeChannelId) {
      const def = community.channels.find((c: any) => c.isDefault) ?? community.channels[0];
      if (def) setActiveChannelId(def.id);
    }
  }, [community?.channels]);

  const { data: feed, isLoading: feedLoading, fetchNextPage, hasNextPage } = trpc.community.member.getFeed.useInfiniteQuery(
    { communityId: community?.id ?? 0, channelId: activeChannelId ?? undefined, sort, limit: 15 },
    {
      enabled: !!community?.id && isMember && !!activeChannelId,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    }
  );

  const allPosts = feed?.pages.flatMap((p: any) => p.items) ?? [];
  const activeChannel = community?.channels?.find((c: any) => c.id === activeChannelId);

  useEffect(() => {
    if (community?.title) document.title = `${community.title} | Community | All About Ultrasound™`;
    return () => { document.title = "All About Ultrasound™"; };
  }, [community?.title]);

  if (communityLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Skeleton className="h-40 rounded-xl mb-6" />
          <div className="grid grid-cols-5 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <div className="col-span-3 space-y-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Community not found</h2>
          <Link href="/community"><Button variant="outline">Back to Communities</Button></Link>
        </div>
      </div>
    );
  }

  const accentColor = community.accentColor || "#189aa1";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Community header */}
      <div className="relative" style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)` }}>
        {community.bannerImage ? (
          <div className="absolute inset-0">
            <img src={community.bannerImage} alt="" className="w-full h-full object-cover opacity-30" />
          </div>
        ) : community.coverImage ? (
          <div className="absolute inset-0">
            <img src={community.coverImage} alt="" className="w-full h-full object-cover opacity-20" />
          </div>
        ) : null}
        <div className="relative max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-start gap-4">
            {community.iconImage || community.logoImage ? (
              <img src={community.iconImage || community.logoImage} alt={community.title} className="w-16 h-16 rounded-xl object-cover shadow-md" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-2xl shadow-md">
                {community.title.charAt(0)}
              </div>
            )}
            <div className="flex-1 text-white">
              <h1 className="text-2xl font-bold">{community.title}</h1>
              {community.welcomeMessage && isMember && (
                <p className="text-white/90 text-sm mt-1 max-w-xl">{community.welcomeMessage}</p>
              )}
              {community.description && <p className="text-white/80 text-sm mt-1 max-w-xl">{community.description}</p>}
              <div className="flex items-center gap-4 mt-2 text-white/70 text-sm">
                <span><Users className="w-3.5 h-3.5 inline mr-1" />{community.memberCount?.toLocaleString()} members</span>
                <span>{community.channels?.length} channels</span>
              </div>
            </div>
            <div>
              {!isAuthenticated ? (
                <a href={getLoginUrl(`/community/${slug}`)}>
                  <Button className="bg-white text-gray-800 hover:bg-gray-100 font-semibold">Sign In</Button>
                </a>
              ) : !isMember ? (
                <Button className="bg-white text-gray-800 hover:bg-gray-100 font-semibold"
                  onClick={() => joinMutation.mutate({ communityId: community.id })}
                  disabled={joinMutation.isPending}>
                  {joinMutation.isPending ? "Joining…" : "Join Community"}
                </Button>
              ) : (
                <Badge className="bg-white/20 text-white border-white/30">Member</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {!isMember && community.landingPageBlocks && (
          <CommunityPageBlocks blocksJson={community.landingPageBlocks} />
        )}
        {isMember && community.pageBlocks && (
          <CommunityPageBlocks blocksJson={community.pageBlocks} />
        )}

        <div className={`grid gap-6 ${showMembersSidebar && isMember ? "grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_minmax(300px,360px)]" : community.layoutStyle === "full-width" ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]"}`}>
          {/* Channels sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardContent className="p-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-2">Channels</h3>
                <div className="space-y-0.5">
                  {community.channels?.map((ch: any) => (
                    <button
                      key={ch.id}
                      onClick={() => setActiveChannelId(ch.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                        activeChannelId === ch.id
                          ? "bg-teal-50 text-teal-700 font-medium"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <Hash className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                      <span className="truncate">{ch.name}</span>
                    </button>
                  ))}
                </div>

                {/* Quick links */}
                <div className="mt-3 pt-3 border-t space-y-0.5">
                  <Link href="/community/leaderboard">
                    <button className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 text-gray-600 hover:bg-gray-100 transition-colors">
                      <Star className="w-3.5 h-3.5 opacity-60" />Leaderboard
                    </button>
                  </Link>
                  {isAuthenticated && (
                    <Link href="/community/dms">
                      <button className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 text-gray-600 hover:bg-gray-100 transition-colors">
                        <Mail className="w-3.5 h-3.5 opacity-60" />Messages
                      </button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Feed */}
          <div className="min-w-0">
            {/* Channel header with avatar strip */}
            {isMember && (
              <ChannelHeader
                channel={activeChannel}
                community={community}
                memberCount={community.memberCount ?? 0}
                recentMembers={recentMembers ?? []}
                showMembersSidebar={showMembersSidebar}
                onToggleSidebar={() => setShowMembersSidebar(s => !s)}
              />
            )}

            {/* Sort bar */}
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setSort("newest")} className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors ${sort === "newest" ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                Newest
              </button>
              <button onClick={() => setSort("trending")} className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1 ${sort === "trending" ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                <Flame className="w-3.5 h-3.5" />Trending
              </button>
            </div>

            {!isMember ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <h3 className="font-semibold text-gray-700 mb-2">Join to see the feed</h3>
                  <p className="text-sm text-gray-500 mb-4">Become a member to read and post discussions.</p>
                  {!isAuthenticated ? (
                    <a href={getLoginUrl(`/community/${slug}`)}>
                      <Button className="bg-teal-600 hover:bg-teal-700 text-white">Sign In to Join</Button>
                    </a>
                  ) : (
                    <Button className="bg-teal-600 hover:bg-teal-700 text-white"
                      onClick={() => joinMutation.mutate({ communityId: community.id })}
                      disabled={joinMutation.isPending}>
                      Join Community
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {activeChannelId && (
                  <CreatePostBox communityId={community.id} channelId={activeChannelId} onPosted={() => {}} />
                )}

                {feedLoading ? (
                  <div className="space-y-4">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
                  </div>
                ) : allPosts.length === 0 ? (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <h3 className="font-semibold text-gray-700 mb-1">No posts yet</h3>
                      <p className="text-sm text-gray-500">Be the first to start a discussion!</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {allPosts.map((post: any) => (
                      <PostCard key={post.id} post={post} isAdmin={isAdmin} communityId={community.id} />
                    ))}
                    {hasNextPage && (
                      <div className="text-center pt-2">
                        <Button variant="outline" onClick={() => fetchNextPage()}>Load more</Button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Members sidebar (collapsible) */}
          {showMembersSidebar && isMember && (
            <div className="hidden lg:block">
              <Card className="sticky top-4 max-h-[calc(100vh-5rem)] overflow-hidden flex flex-col min-w-0">
                <CardContent className="p-4 flex-1 flex flex-col min-h-0">
                  <MembersSidebar communityId={community.id} currentUserId={user?.id} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
