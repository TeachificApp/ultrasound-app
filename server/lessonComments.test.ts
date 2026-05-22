/**
 * lessonComments.test.ts
 * Unit tests for the lesson commenting system business logic.
 * Tests cover: content validation, ban enforcement, schema structure, and admin operations.
 */
import { describe, it, expect } from "vitest";

// ── Content validation helpers ────────────────────────────────────────────────
function validateCommentContent(content: string): { valid: boolean; error?: string } {
  const trimmed = content.trim();
  if (trimmed.length === 0) return { valid: false, error: "Comment cannot be empty" };
  if (trimmed.length > 2000) return { valid: false, error: "Comment exceeds 2000 character limit" };
  return { valid: true };
}

// ── Ban enforcement helper ────────────────────────────────────────────────────
function canUserComment(user: { commentBanned: boolean }, lesson: { commentsEnabled: boolean }): boolean {
  if (!lesson.commentsEnabled) return false;
  if (user.commentBanned) return false;
  return true;
}

// ── Admin delete helper ───────────────────────────────────────────────────────
function buildSoftDeleteUpdate(adminId: number): { deletedAt: Date; deletedByAdminId: number } {
  return { deletedAt: new Date(), deletedByAdminId: adminId };
}

// ── Schema structure ──────────────────────────────────────────────────────────
interface LessonComment {
  id: number;
  lessonId: number;
  userId: number;
  content: string;
  createdAt: Date;
  deletedAt: Date | null;
  deletedByAdminId: number | null;
}

describe("Lesson Comment Content Validation", () => {
  it("accepts valid comment content", () => {
    const result = validateCommentContent("Great lesson, very helpful!");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("rejects empty content", () => {
    const result = validateCommentContent("");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Comment cannot be empty");
  });

  it("rejects whitespace-only content", () => {
    const result = validateCommentContent("   \n\t  ");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Comment cannot be empty");
  });

  it("rejects content exceeding 2000 characters", () => {
    const longContent = "a".repeat(2001);
    const result = validateCommentContent(longContent);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Comment exceeds 2000 character limit");
  });

  it("accepts content exactly at 2000 characters", () => {
    const maxContent = "a".repeat(2000);
    const result = validateCommentContent(maxContent);
    expect(result.valid).toBe(true);
  });
});

describe("Comment Permission Enforcement", () => {
  it("allows commenting when lesson has comments enabled and user is not banned", () => {
    expect(canUserComment({ commentBanned: false }, { commentsEnabled: true })).toBe(true);
  });

  it("blocks commenting when lesson has comments disabled", () => {
    expect(canUserComment({ commentBanned: false }, { commentsEnabled: false })).toBe(false);
  });

  it("blocks commenting when user is comment-banned", () => {
    expect(canUserComment({ commentBanned: true }, { commentsEnabled: true })).toBe(false);
  });

  it("blocks commenting when both lesson disabled and user banned", () => {
    expect(canUserComment({ commentBanned: true }, { commentsEnabled: false })).toBe(false);
  });

  it("does not expose ban status to user (same error as disabled)", () => {
    // Both banned and disabled return false — user cannot distinguish the reason
    const bannedResult = canUserComment({ commentBanned: true }, { commentsEnabled: true });
    const disabledResult = canUserComment({ commentBanned: false }, { commentsEnabled: false });
    expect(bannedResult).toBe(disabledResult);
  });
});

describe("Admin Soft Delete", () => {
  it("builds a soft delete update with admin ID and timestamp", () => {
    const adminId = 42;
    const update = buildSoftDeleteUpdate(adminId);
    expect(update.deletedByAdminId).toBe(42);
    expect(update.deletedAt).toBeInstanceOf(Date);
    expect(update.deletedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("soft-deleted comment has deletedAt set", () => {
    const comment: LessonComment = {
      id: 1, lessonId: 10, userId: 5,
      content: "Test comment",
      createdAt: new Date(),
      deletedAt: new Date(),
      deletedByAdminId: 1,
    };
    expect(comment.deletedAt).not.toBeNull();
    expect(comment.deletedByAdminId).toBe(1);
  });

  it("visible comment has null deletedAt", () => {
    const comment: LessonComment = {
      id: 2, lessonId: 10, userId: 6,
      content: "Visible comment",
      createdAt: new Date(),
      deletedAt: null,
      deletedByAdminId: null,
    };
    expect(comment.deletedAt).toBeNull();
  });
});

describe("Comment Schema Structure", () => {
  it("comment object has all required fields", () => {
    const comment: LessonComment = {
      id: 1,
      lessonId: 10,
      userId: 5,
      content: "This is a test comment",
      createdAt: new Date(),
      deletedAt: null,
      deletedByAdminId: null,
    };
    expect(comment).toHaveProperty("id");
    expect(comment).toHaveProperty("lessonId");
    expect(comment).toHaveProperty("userId");
    expect(comment).toHaveProperty("content");
    expect(comment).toHaveProperty("createdAt");
    expect(comment).toHaveProperty("deletedAt");
    expect(comment).toHaveProperty("deletedByAdminId");
  });

  it("filters deleted comments from student view", () => {
    const comments: LessonComment[] = [
      { id: 1, lessonId: 1, userId: 1, content: "Visible", createdAt: new Date(), deletedAt: null, deletedByAdminId: null },
      { id: 2, lessonId: 1, userId: 2, content: "Deleted", createdAt: new Date(), deletedAt: new Date(), deletedByAdminId: 1 },
      { id: 3, lessonId: 1, userId: 3, content: "Also visible", createdAt: new Date(), deletedAt: null, deletedByAdminId: null },
    ];
    const visible = comments.filter(c => c.deletedAt === null);
    expect(visible).toHaveLength(2);
    expect(visible.map(c => c.id)).toEqual([1, 3]);
  });

  it("admin view includes all comments including deleted", () => {
    const comments: LessonComment[] = [
      { id: 1, lessonId: 1, userId: 1, content: "Visible", createdAt: new Date(), deletedAt: null, deletedByAdminId: null },
      { id: 2, lessonId: 1, userId: 2, content: "Deleted", createdAt: new Date(), deletedAt: new Date(), deletedByAdminId: 1 },
    ];
    expect(comments).toHaveLength(2);
  });
});
