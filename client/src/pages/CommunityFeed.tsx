/**
 * CommunityFeed.tsx
 * The main community space view: channel sidebar, post feed, post creation, reactions, comments.
 */
import { useState, useRef, useCallback, useEffect } from "react";
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
import {
  MessageSquare, Heart, Bookmark, BookmarkCheck, MoreHorizontal,
  Image as ImageIcon, BarChart2, Send, ChevronDown, ChevronUp,
  Pin, Lock, EyeOff, Flag, Trash2, Edit2, Hash, Plus, Users, X,
  ThumbsUp, Smile, Star, Flame
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";

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
  const name = author?.displayName || author?.name || "?";
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
  const utils = trpc.useUtils();
  const { data: post, isLoading } = trpc.community.member.getPost.useQuery(
    { postId },
    { enabled: isOpen }
  );
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
          {post?.comments?.map((c: any) => (
            <div key={c.id} className={`flex gap-3 ${c.parentId ? "ml-8" : ""}`}>
              <AuthorAvatar author={c.author} />
              <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900">{c.author?.displayName || c.author?.name || "Unknown"}</span>
                  {c.author?.credentials && <span className="text-xs text-teal-600 font-medium">{c.author.credentials}</span>}
                  <span className="text-xs text-gray-400 ml-auto">{timeAgo(c.createdAt)}</span>
                </div>
                {c.body && (c.body.startsWith('<') ? <RichTextDisplay content={c.body} className="text-sm text-gray-700" /> : <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>)}
              </div>
            </div>
          ))}
          {(!post?.comments || post.comments.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-4">No comments yet. Be the first!</p>
          )}
        </div>
      )}
      {user && (
        <div className="flex gap-3 mt-4">
          <AuthorAvatar author={user} />
          <div className="flex-1 flex gap-2">
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
              onClick={() => addComment.mutate({ postId, body })}
            >
              <Send className="w-4 h-4" />
            </Button>
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
            <AuthorAvatar author={post.author} size="md" className="cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={post.author?.id ? `/community/members/${post.author.id}` : "#"}>
                <span className="font-semibold text-gray-900 text-sm hover:text-teal-600 cursor-pointer transition-colors">{post.author?.displayName || post.author?.name || "Unknown"}</span>
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
                <DropdownMenuItem onClick={() => reportMutation.mutate({ targetType: "post", targetId: post.id, reason: "Inappropriate content" })}>
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
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{post.commentCount || 0}</span>
          </button>
          <button
            onClick={() => bookmarkMutation.mutate({ postId: post.id })}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm transition-colors ml-auto ${
              post.isBookmarked ? "text-teal-600 bg-teal-50" : "text-gray-500 hover:bg-gray-100"
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

function CreatePostBox({ communityId, channelId, onPosted }: { communityId: number; channelId: number; onPosted: () => void }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [postType, setPostType] = useState<"text" | "image" | "video" | "poll" | "case_study">("text");
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const uploadImage = trpc.community.member.uploadPostImage.useMutation({
    onSuccess: (data) => setImageUrl(data.url),
    onError: (e) => toast.error("Image upload failed: " + e.message),
  });

  const createPost = trpc.community.member.createPost.useMutation({
    onSuccess: () => {
      setBody(""); setTitle(""); setImageDataUri(null); setImageUrl(null);
      setPollQuestion(""); setPollOptions(["", ""]); setExpanded(false);
      toast.success("Post published!");
      utils.community.member.getFeed.invalidate({ communityId });
      onPosted();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8_000_000) { toast.error("Image must be under 8 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      setImageDataUri(dataUri);
      uploadImage.mutate({ dataUri, mimeType: file.type as any });
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit() {
    if (!body.trim()) { toast.error("Post body is required"); return; }
    const attachments = imageUrl ? [{ url: imageUrl, type: "image/jpeg" }] : undefined;
    const poll = postType === "poll" && pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2
      ? { question: pollQuestion.trim(), options: pollOptions.filter(o => o.trim()) }
      : undefined;
    createPost.mutate({ communityId, channelId, title: title.trim() || undefined, body: body.trim(), postType, attachments, poll });
  }

  if (!user) return null;

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        {!expanded ? (
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(true)}>
            <AuthorAvatar author={user} size="md" />
            <div className="flex-1 bg-gray-100 hover:bg-gray-200 transition-colors rounded-full px-4 py-2.5 text-sm text-gray-500">
              Share something with the community…
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start gap-3 mb-3">
              <AuthorAvatar author={user} size="md" />
              <div className="flex-1">
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="mb-2 text-sm"
                />
                <RichTextEditor
                  value={body}
                  onChange={setBody}
                  placeholder="Share a case, ask a question, or start a discussion… Use #hashtags to categorize."
                  minHeight={100}
                />
              </div>
            </div>

            {/* Image preview */}
            {imageDataUri && (
              <div className="relative mb-3 ml-13">
                <img src={imageDataUri} alt="Preview" className="rounded-lg max-h-48 object-cover" />
                {uploadImage.isPending && <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-lg text-sm text-gray-500">Uploading…</div>}
                <button onClick={() => { setImageDataUri(null); setImageUrl(null); }} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Poll builder */}
            {postType === "poll" && (
              <div className="ml-13 mb-3 border rounded-xl p-3 space-y-2">
                <Input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Poll question…" className="text-sm" />
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={opt} onChange={e => { const o = [...pollOptions]; o[i] = e.target.value; setPollOptions(o); }} placeholder={`Option ${i + 1}`} className="text-sm" />
                    {pollOptions.length > 2 && <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}><X className="w-3 h-3" /></Button>}
                  </div>
                ))}
                {pollOptions.length < 6 && <Button variant="ghost" size="sm" onClick={() => setPollOptions([...pollOptions, ""])} className="text-teal-600"><Plus className="w-3 h-3 mr-1" />Add option</Button>}
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-2 mt-3">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-teal-600" onClick={() => { setPostType("image"); fileRef.current?.click(); }}>
                <ImageIcon className="w-4 h-4 mr-1" />Photo
              </Button>
              <Button variant="ghost" size="sm" className={`text-gray-500 hover:text-teal-600 ${postType === "poll" ? "text-teal-600 bg-teal-50" : ""}`}
                onClick={() => setPostType(postType === "poll" ? "text" : "poll")}>
                <BarChart2 className="w-4 h-4 mr-1" />Poll
              </Button>
              <Button variant="ghost" size="sm" className={`text-gray-500 hover:text-teal-600 ${postType === "case_study" ? "text-teal-600 bg-teal-50" : ""}`}
                onClick={() => setPostType(postType === "case_study" ? "text" : "case_study")}>
                <Hash className="w-4 h-4 mr-1" />Case
              </Button>
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setExpanded(false); setBody(""); setTitle(""); }}>Cancel</Button>
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={!body || createPost.isPending || uploadImage.isPending} onClick={handleSubmit}>
                  {createPost.isPending ? "Posting…" : "Post"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CommunityFeed() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [sort, setSort] = useState<"newest" | "trending">("newest");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: community, isLoading: communityLoading } = trpc.community.public.getCommunity.useQuery(
    { slug: slug! },
    { enabled: !!slug }
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
  const isAdmin = (user as any)?.role === "admin";
  const isMember = !!membership || isAdmin;

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
      enabled: !!community?.id && isMember,
      getNextPageParam: (last: any) => last.nextCursor,
      initialCursor: undefined,
    }
  );

  const allPosts = feed?.pages.flatMap((p: any) => p.items) ?? [];

  useEffect(() => {
    if (community?.title) document.title = `${community.title} | Community | All About Ultrasound™`;
    return () => { document.title = "All About Ultrasound™"; };
  }, [community?.title]);

  if (communityLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <Skeleton className="h-40 rounded-xl mb-6" />
          <div className="grid grid-cols-4 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <div className="col-span-3 space-y-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
            </div>
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
        {community.coverImage && (
          <div className="absolute inset-0">
            <img src={community.coverImage} alt="" className="w-full h-full object-cover opacity-20" />
          </div>
        )}
        <div className="relative max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-start gap-4">
            {community.logoImage ? (
              <img src={community.logoImage} alt={community.title} className="w-16 h-16 rounded-xl object-cover shadow-md" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-2xl shadow-md">
                {community.title.charAt(0)}
              </div>
            )}
            <div className="flex-1 text-white">
              <h1 className="text-2xl font-bold">{community.title}</h1>
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

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Channels sidebar */}
          <div className="lg:col-span-1">
            <Card>
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
              </CardContent>
            </Card>
          </div>

          {/* Feed */}
          <div className="lg:col-span-3">
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
        </div>
      </div>
    </div>
  );
}
