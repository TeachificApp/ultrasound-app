/**
 * AdminLessonComments.tsx
 * Admin panel for managing lesson comments across all courses.
 * Features: view all top-level comments, expand replies per comment,
 * delete individual comments/replies, ban/unban users from commenting.
 * No notifications are sent to users when banned.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MessageSquare, Trash2, Ban, UserCheck, Search, Loader2, ChevronDown, ChevronRight, CornerDownRight } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

type AdminComment = {
  id: number;
  lessonId: number;
  userId: number;
  content: string;
  parentId: number | null;
  createdAt: Date | string;
  lessonTitle?: string | null;
  courseTitle?: string | null;
  authorName?: string | null;
  authorDisplayName?: string | null;
  authorAvatarUrl?: string | null;
  authorCommentBanned?: boolean | null;
  replyCount: number;
};

type AdminReply = {
  id: number;
  userId: number;
  content: string;
  parentId: number | null;
  createdAt: Date | string;
  authorName?: string | null;
  authorDisplayName?: string | null;
  authorAvatarUrl?: string | null;
  authorCommentBanned?: boolean | null;
};

export default function AdminLessonComments() {
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; content: string } | null>(null);
  const [confirmBan, setConfirmBan] = useState<{ userId: number; name: string; isBanned: boolean } | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.lessonComments.adminList.useInfiniteQuery(
      { limit: 30, search: search.trim() || undefined },
      {
        getNextPageParam: (lastPage) => {
          if (!lastPage.hasMore) return undefined;
          const items = lastPage.comments;
          return items.length > 0 ? items[items.length - 1].id : undefined;
        },
      }
    );

  const deleteComment = trpc.lessonComments.delete.useMutation({
    onSuccess: () => {
      toast.success("Comment deleted");
      utils.lessonComments.adminList.invalidate();
      utils.lessonComments.adminListReplies.invalidate();
      setConfirmDelete(null);
    },
    onError: (e) => toast.error(`Failed to delete: ${e.message}`),
  });

  const banUser = trpc.lessonComments.banUser.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.banned ? "User restricted from commenting" : "User restriction removed");
      utils.lessonComments.adminList.invalidate();
      utils.lessonComments.adminListReplies.invalidate();
      setConfirmBan(null);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const allComments = data?.pages.flatMap(p => p.comments) ?? [];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-teal-600" />
              Lesson Comments
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage student discussion across all lessons. Delete comments or restrict users from commenting.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by student name, comment content, or lesson title…"
            className="pl-9 text-sm"
          />
        </div>

        {/* Comment list */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading comments…
          </div>
        ) : allComments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{search ? "No comments match your search." : "No comments yet across any lessons."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allComments.map(comment => (
              <CommentRow
                key={comment.id}
                comment={comment}
                onDelete={() => setConfirmDelete({ id: comment.id, content: comment.content })}
                onToggleBan={() => setConfirmBan({
                  userId: comment.userId,
                  name: comment.authorDisplayName || comment.authorName || "this user",
                  isBanned: !!comment.authorCommentBanned,
                })}
                onDeleteReply={(replyId, content) => setConfirmDelete({ id: replyId, content })}
                onToggleBanUser={(userId, name, isBanned) => setConfirmBan({ userId, name, isBanned })}
              />
            ))}
            {hasNextPage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="w-full text-xs text-gray-500 border-gray-200 mt-2"
              >
                {isFetchingNextPage ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <ChevronDown className="w-3.5 h-3.5 mr-1.5" />}
                Load more
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The comment will be permanently removed.
              <blockquote className="mt-2 border-l-4 border-gray-200 pl-3 text-sm text-gray-600 italic line-clamp-3">
                {confirmDelete?.content}
              </blockquote>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteComment.mutate({ commentId: confirmDelete.id })}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteComment.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ban/unban confirmation */}
      <AlertDialog open={!!confirmBan} onOpenChange={() => setConfirmBan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmBan?.isBanned ? "Remove comment restriction?" : "Restrict from commenting?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmBan?.isBanned
                ? `${confirmBan.name} will be able to post comments again.`
                : `${confirmBan?.name} will no longer be able to post comments on any lesson. They will not be notified.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmBan && banUser.mutate({ userId: confirmBan.userId, banned: !confirmBan.isBanned })}
              className={confirmBan?.isBanned ? "bg-teal-600 hover:bg-teal-700 text-white" : "bg-orange-600 hover:bg-orange-700 text-white"}
            >
              {banUser.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {confirmBan?.isBanned ? "Remove restriction" : "Restrict user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

function CommentRow({ comment, onDelete, onToggleBan, onDeleteReply, onToggleBanUser }: {
  comment: AdminComment;
  onDelete: () => void;
  onToggleBan: () => void;
  onDeleteReply: (replyId: number, content: string) => void;
  onToggleBanUser: (userId: number, name: string, isBanned: boolean) => void;
}) {
  const [showReplies, setShowReplies] = useState(false);
  const displayName = comment.authorDisplayName || comment.authorName || "Unknown";
  const isBanned = !!comment.authorCommentBanned;
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });

  const { data: repliesData, isLoading: repliesLoading } = trpc.lessonComments.adminListReplies.useQuery(
    { parentId: comment.id },
    { enabled: showReplies }
  );

  return (
    <div className={cn(
      "rounded-xl border bg-white shadow-sm overflow-hidden",
      isBanned && "border-orange-200 bg-orange-50/30"
    )}>
      {/* Main comment */}
      <div className="flex gap-3 p-4">
        <Avatar className="w-9 h-9 shrink-0 mt-0.5">
          <AvatarImage src={comment.authorAvatarUrl ?? undefined} />
          <AvatarFallback className="bg-teal-100 text-teal-700 text-xs font-bold">
            {getInitials(comment.authorDisplayName || comment.authorName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-800">{displayName}</span>
              {isBanned && (
                <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 bg-orange-50">
                  <Ban className="w-3 h-3 mr-1" /> Restricted
                </Badge>
              )}
              <span className="text-xs text-gray-400">{timeAgo}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={onToggleBan}
                className={cn(
                  "h-7 px-2 text-xs",
                  isBanned
                    ? "text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                    : "text-orange-500 hover:text-orange-700 hover:bg-orange-50"
                )}
                title={isBanned ? "Remove comment restriction" : "Restrict user from commenting"}
              >
                {isBanned ? <UserCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                title="Delete comment"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          {(comment.courseTitle || comment.lessonTitle) && (
            <p className="text-xs text-teal-600 mt-0.5">
              {comment.courseTitle && <span className="font-medium">{comment.courseTitle}</span>}
              {comment.courseTitle && comment.lessonTitle && <span className="text-gray-400 mx-1">›</span>}
              {comment.lessonTitle && <span>{comment.lessonTitle}</span>}
            </p>
          )}
          <p className="text-sm text-gray-700 mt-1.5 whitespace-pre-wrap break-words leading-relaxed">
            {comment.content}
          </p>

          {/* Show Replies toggle */}
          {comment.replyCount > 0 && (
            <button
              onClick={() => setShowReplies(v => !v)}
              className="mt-2 flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-medium transition-colors"
            >
              {showReplies
                ? <ChevronDown className="w-3.5 h-3.5" />
                : <ChevronRight className="w-3.5 h-3.5" />}
              {showReplies ? "Hide" : "Show"} {comment.replyCount} {comment.replyCount === 1 ? "reply" : "replies"}
            </button>
          )}
        </div>
      </div>

      {/* Replies section */}
      {showReplies && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3 space-y-3">
          {repliesLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading replies…
            </div>
          ) : repliesData?.replies.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No replies found.</p>
          ) : (
            repliesData?.replies.map(reply => (
              <ReplyRow
                key={reply.id}
                reply={reply}
                onDelete={() => onDeleteReply(reply.id, reply.content)}
                onToggleBan={() => onToggleBanUser(
                  reply.userId,
                  reply.authorDisplayName || reply.authorName || "this user",
                  !!reply.authorCommentBanned
                )}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ReplyRow({ reply, onDelete, onToggleBan }: {
  reply: AdminReply;
  onDelete: () => void;
  onToggleBan: () => void;
}) {
  const displayName = reply.authorDisplayName || reply.authorName || "Unknown";
  const isBanned = !!reply.authorCommentBanned;
  const timeAgo = formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true });

  return (
    <div className={cn(
      "flex gap-2.5 p-3 rounded-lg border bg-white",
      isBanned && "border-orange-200 bg-orange-50/30"
    )}>
      <CornerDownRight className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-1" />
      <Avatar className="w-7 h-7 shrink-0 mt-0.5">
        <AvatarImage src={reply.authorAvatarUrl ?? undefined} />
        <AvatarFallback className="bg-teal-100 text-teal-700 text-[10px] font-bold">
          {getInitials(reply.authorDisplayName || reply.authorName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-800">{displayName}</span>
            {isBanned && (
              <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300 bg-orange-50 px-1.5 py-0">
                <Ban className="w-2.5 h-2.5 mr-0.5" /> Restricted
              </Badge>
            )}
            <span className="text-[10px] text-gray-400">{timeAgo}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={onToggleBan}
              className={cn(
                "h-6 px-1.5 text-[10px]",
                isBanned
                  ? "text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                  : "text-orange-500 hover:text-orange-700 hover:bg-orange-50"
              )}
              title={isBanned ? "Remove comment restriction" : "Restrict user from commenting"}
            >
              {isBanned ? <UserCheck className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              className="h-6 px-1.5 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50"
              title="Delete reply"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap break-words leading-relaxed">
          {reply.content}
        </p>
      </div>
    </div>
  );
}
