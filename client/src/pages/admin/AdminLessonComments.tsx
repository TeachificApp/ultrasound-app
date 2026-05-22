/**
 * AdminLessonComments.tsx
 * Admin panel for managing lesson comments across all courses.
 * Features: view all comments, delete individual comments, ban/unban users from commenting.
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
import { MessageSquare, Trash2, Ban, UserCheck, Search, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

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
      setConfirmDelete(null);
    },
    onError: (e) => toast.error(`Failed to delete: ${e.message}`),
  });

  const banUser = trpc.lessonComments.banUser.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.banned ? "User banned from commenting" : "User unbanned");
      utils.lessonComments.adminList.invalidate();
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

function CommentRow({ comment, onDelete, onToggleBan }: {
  comment: {
    id: number;
    userId: number;
    content: string;
    createdAt: Date | string;
    lessonTitle?: string | null;
    courseTitle?: string | null;
    authorName?: string | null;
    authorDisplayName?: string | null;
    authorAvatarUrl?: string | null;
    authorCommentBanned?: boolean | null;
  };
  onDelete: () => void;
  onToggleBan: () => void;
}) {
  const displayName = comment.authorDisplayName || comment.authorName || "Unknown";
  const isBanned = !!comment.authorCommentBanned;
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });

  return (
    <div className={cn(
      "flex gap-3 p-4 rounded-xl border bg-white shadow-sm",
      isBanned && "border-orange-200 bg-orange-50/30"
    )}>
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
      </div>
    </div>
  );
}
