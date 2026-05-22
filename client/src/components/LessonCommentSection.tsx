/**
 * LessonCommentSection.tsx
 * Student-facing comment section shown at the bottom of a lesson when commentsEnabled = true.
 * Supports one-level-deep reply threading, paginated listing, and optimistic updates.
 */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Send, Loader2, Reply, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface CommentReply {
  id: number;
  userId: number;
  content: string;
  parentId: number | null;
  createdAt: Date | string;
  authorName?: string | null;
  authorDisplayName?: string | null;
  authorAvatarUrl?: string | null;
  authorCredentials?: string | null;
  isOwn?: boolean;
}

interface Comment extends CommentReply {
  replies: CommentReply[];
}

interface LessonCommentSectionProps {
  lessonId: number;
  commentsEnabled: boolean;
}

function getInitials(name?: string | null, displayName?: string | null): string {
  const n = displayName || name || "?";
  return n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function CommentAvatar({ name, displayName, avatarUrl }: { name?: string | null; displayName?: string | null; avatarUrl?: string | null }) {
  return (
    <Avatar className="w-8 h-8 shrink-0 mt-0.5">
      <AvatarImage src={avatarUrl ?? undefined} />
      <AvatarFallback className="bg-teal-100 text-teal-700 text-xs font-bold">
        {getInitials(name, displayName)}
      </AvatarFallback>
    </Avatar>
  );
}

function ReplyBox({
  lessonId,
  parentId,
  onSuccess,
  onCancel,
}: {
  lessonId: number;
  parentId: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const { user } = useAuth();
  const addComment = trpc.lessonComments.add.useMutation({
    onSuccess: () => {
      setText("");
      onSuccess();
    },
    onError: (e) => {
      toast.error(e.message === "Comments are not enabled for this lesson"
        ? "You are not able to comment on this lesson."
        : `Failed to post reply: ${e.message}`);
    },
  });

  const handleSubmit = () => {
    const content = text.trim();
    if (!content || !user) return;
    addComment.mutate({ lessonId, content, parentId });
  };

  return (
    <div className="flex gap-2 mt-2">
      <CommentAvatar name={user?.name} displayName={(user as any)?.displayName} avatarUrl={user?.avatarUrl} />
      <div className="flex-1 space-y-1.5">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Write a reply… (Ctrl+Enter to post)"
          className="min-h-[64px] text-sm resize-none border-gray-200 focus:border-teal-400 focus:ring-teal-400"
          maxLength={2000}
          autoFocus
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(); }
            if (e.key === "Escape") onCancel();
          }}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs text-gray-500">Cancel</Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!text.trim() || addComment.isPending}
            className="bg-teal-500 hover:bg-teal-600 text-white text-xs px-3"
          >
            {addComment.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
            Reply
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  lessonId,
  onReplyAdded,
}: {
  comment: Comment;
  lessonId: number;
  onReplyAdded: () => void;
}) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const displayName = comment.authorDisplayName || comment.authorName || "Student";
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });
  const replyCount = comment.replies?.length ?? 0;

  return (
    <div className="flex gap-3">
      <CommentAvatar name={comment.authorName} displayName={comment.authorDisplayName} avatarUrl={comment.authorAvatarUrl} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-800">{displayName}</span>
          {comment.authorCredentials && (
            <span className="text-xs text-teal-600 font-medium">{comment.authorCredentials}</span>
          )}
          <span className="text-xs text-gray-400">{timeAgo}</span>
        </div>
        <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
          {comment.content}
        </p>

        {/* Actions row */}
        <div className="flex items-center gap-3 mt-1.5">
          <button
            onClick={() => setShowReplyBox(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-teal-600 transition-colors"
          >
            <Reply size={11} /> Reply
          </button>
          {replyCount > 0 && (
            <button
              onClick={() => setShowReplies(v => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-teal-600 transition-colors"
            >
              {showReplies ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {replyCount} {replyCount === 1 ? "reply" : "replies"}
            </button>
          )}
        </div>

        {/* Reply input box */}
        {showReplyBox && (
          <ReplyBox
            lessonId={lessonId}
            parentId={comment.id}
            onSuccess={() => { setShowReplyBox(false); onReplyAdded(); }}
            onCancel={() => setShowReplyBox(false)}
          />
        )}

        {/* Nested replies */}
        {showReplies && replyCount > 0 && (
          <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-100">
            {comment.replies.map(reply => {
              const replyName = reply.authorDisplayName || reply.authorName || "Student";
              const replyTimeAgo = formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true });
              return (
                <div key={reply.id} className="flex gap-2">
                  <CommentAvatar name={reply.authorName} displayName={reply.authorDisplayName} avatarUrl={reply.authorAvatarUrl} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{replyName}</span>
                      {reply.authorCredentials && (
                        <span className="text-xs text-teal-600 font-medium">{reply.authorCredentials}</span>
                      )}
                      <span className="text-xs text-gray-400">{replyTimeAgo}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
                      {reply.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LessonCommentSection({ lessonId, commentsEnabled }: LessonCommentSectionProps) {
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const utils = trpc.useUtils();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.lessonComments.list.useInfiniteQuery(
      { lessonId, limit: 20 },
      {
        enabled: commentsEnabled && isExpanded && !!user,
        getNextPageParam: (lastPage) => {
          if (!lastPage.hasMore) return undefined;
          const comments = lastPage.comments;
          return comments.length > 0 ? comments[comments.length - 1].id : undefined;
        },
      }
    );

  const addComment = trpc.lessonComments.add.useMutation({
    onSuccess: () => {
      setDraft("");
      utils.lessonComments.list.invalidate({ lessonId });
      toast.success("Comment posted");
    },
    onError: (e) => {
      toast.error(e.message === "Comments are not enabled for this lesson"
        ? "You are not able to comment on this lesson."
        : `Failed to post comment: ${e.message}`);
    },
  });

  if (!commentsEnabled) return null;

  const allComments: Comment[] = (data?.pages.flatMap(p => p.comments) ?? []) as Comment[];

  const handleSubmit = () => {
    const content = draft.trim();
    if (!content) return;
    if (!user) { toast.error("Please sign in to comment"); return; }
    addComment.mutate({ lessonId, content });
  };

  const handleReplyAdded = () => {
    utils.lessonComments.list.invalidate({ lessonId });
  };

  return (
    <div className="mt-8 border-t border-gray-200 pt-6">
      {/* Header toggle */}
      <button
        onClick={() => setIsExpanded(v => !v)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-teal-600 transition-colors mb-4 group"
      >
        <MessageSquare className="w-4 h-4 text-teal-500 group-hover:text-teal-600" />
        <span>Discussion</span>
        {!isExpanded && (
          <span className="text-xs text-gray-400 font-normal ml-1">Click to expand</span>
        )}
        {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {isExpanded && (
        <div className="space-y-5">
          {/* Comment input */}
          {user ? (
            <div className="flex gap-3">
              <CommentAvatar name={user.name} displayName={(user as any).displayName} avatarUrl={user.avatarUrl} />
              <div className="flex-1 space-y-2">
                <Textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(); }
                  }}
                  placeholder="Share a question or thought about this lesson… (Ctrl+Enter to post)"
                  className="min-h-[80px] text-sm resize-none border-gray-200 focus:border-teal-400 focus:ring-teal-400"
                  maxLength={2000}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{draft.length}/2000</span>
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!draft.trim() || addComment.isPending}
                    className="bg-teal-500 hover:bg-teal-600 text-white text-xs px-4"
                  >
                    {addComment.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                    Post Comment
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Sign in to join the discussion.</p>
          )}

          {/* Comment list */}
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading comments…
            </div>
          ) : allComments.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-2">No comments yet. Be the first to start the discussion!</p>
          ) : (
            <div className="space-y-5">
              {allComments.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  lessonId={lessonId}
                  onReplyAdded={handleReplyAdded}
                />
              ))}
              {hasNextPage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="w-full text-xs text-gray-500 border-gray-200"
                >
                  {isFetchingNextPage ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Load more comments
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
