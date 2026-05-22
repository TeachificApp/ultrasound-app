/**
 * LessonCommentSection.tsx
 * Student-facing comment section shown at the bottom of a lesson when commentsEnabled = true.
 * Supports paginated listing, posting new comments, and optimistic updates.
 */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface LessonCommentSectionProps {
  lessonId: number;
  commentsEnabled: boolean;
}

function getInitials(name?: string | null, displayName?: string | null): string {
  const n = displayName || name || "?";
  return n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function LessonCommentSection({ lessonId, commentsEnabled }: LessonCommentSectionProps) {
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.lessonComments.list.useInfiniteQuery(
      { lessonId, limit: 20 },
      {
        enabled: commentsEnabled && isExpanded,
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

  const allComments = data?.pages.flatMap(p => p.comments) ?? [];
  const totalCount = allComments.length;

  const handleSubmit = () => {
    const content = draft.trim();
    if (!content) return;
    if (!user) {
      toast.error("Please sign in to comment");
      return;
    }
    addComment.mutate({ lessonId, content });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
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
      </button>

      {isExpanded && (
        <div className="space-y-5">
          {/* Comment input */}
          {user ? (
            <div className="flex gap-3">
              <Avatar className="w-8 h-8 shrink-0 mt-0.5">
                <AvatarImage src={user.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-teal-100 text-teal-700 text-xs font-bold">
                  {getInitials(user.name, (user as any).displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
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
                    {addComment.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                    )}
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
            <div className="space-y-4">
              {allComments.map(comment => (
                <CommentItem key={comment.id} comment={comment} currentUserId={user?.id} />
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

function CommentItem({ comment, currentUserId }: {
  comment: {
    id: number;
    userId: number;
    content: string;
    createdAt: Date | string;
    authorName?: string | null;
    authorDisplayName?: string | null;
    authorAvatarUrl?: string | null;
    authorCredentials?: string | null;
    isOwn?: boolean;
  };
  currentUserId?: number;
}) {
  const displayName = comment.authorDisplayName || comment.authorName || "Student";
  const initials = getInitials(comment.authorName, comment.authorDisplayName);
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });

  return (
    <div className={cn("flex gap-3 group", comment.isOwn && "")}>
      <Avatar className="w-8 h-8 shrink-0 mt-0.5">
        <AvatarImage src={comment.authorAvatarUrl ?? undefined} />
        <AvatarFallback className="bg-teal-100 text-teal-700 text-xs font-bold">
          {initials}
        </AvatarFallback>
      </Avatar>
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
      </div>
    </div>
  );
}
