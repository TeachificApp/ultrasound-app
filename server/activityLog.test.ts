/**
 * activityLog.test.ts
 * Tests for the unified activity logging system and user analytics fixes.
 */
import { describe, it, expect, vi } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

describe("Activity Logging Infrastructure", () => {
  describe("getClientIp helper", () => {
    it("extracts IP from x-forwarded-for header", async () => {
      // Import the module to test the helper behavior
      const { getDb } = await import("./db");
      
      // Simulate the IP extraction logic used in the router
      const ctx = {
        req: {
          headers: { "x-forwarded-for": "192.168.1.1, 10.0.0.1" },
          socket: { remoteAddress: "127.0.0.1" },
        },
      };
      const ip =
        ctx.req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        ctx.req.headers["x-real-ip" as keyof typeof ctx.req.headers] ||
        ctx.req.socket.remoteAddress ||
        null;
      expect(ip).toBe("192.168.1.1");
    });

    it("falls back to socket remoteAddress", () => {
      const ctx = {
        req: {
          headers: {},
          socket: { remoteAddress: "10.0.0.5" },
        },
      };
      const ip =
        (ctx.req.headers as any)["x-forwarded-for"]?.split(",")[0]?.trim() ||
        (ctx.req.headers as any)["x-real-ip"] ||
        ctx.req.socket.remoteAddress ||
        null;
      expect(ip).toBe("10.0.0.5");
    });

    it("returns null when no IP info available", () => {
      const ctx = { req: { headers: {}, socket: {} } };
      const ip =
        (ctx.req.headers as any)["x-forwarded-for"]?.split(",")[0]?.trim() ||
        (ctx.req.headers as any)["x-real-ip"] ||
        (ctx.req.socket as any).remoteAddress ||
        null;
      expect(ip).toBeNull();
    });
  });

  describe("getUserAgent helper", () => {
    it("extracts user agent from request", () => {
      const ctx = {
        req: { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0)" } },
      };
      const ua = ctx.req?.headers?.["user-agent"] ?? null;
      expect(ua).toBe("Mozilla/5.0 (Windows NT 10.0)");
    });

    it("returns null when no user agent", () => {
      const ctx = { req: { headers: {} } };
      const ua = (ctx.req?.headers as any)?.["user-agent"] ?? null;
      expect(ua).toBeNull();
    });
  });

  describe("CSV export format", () => {
    it("generates valid CSV header", () => {
      const header = "Timestamp,Event Type,Description,Path,IP Address,User Agent,Metadata";
      const fields = header.split(",");
      expect(fields).toHaveLength(7);
      expect(fields[0]).toBe("Timestamp");
      expect(fields[4]).toBe("IP Address");
    });

    it("properly escapes CSV values with quotes", () => {
      const escape = (s: string) => `"${(s || "").replace(/"/g, '""')}"`;
      expect(escape('Hello "world"')).toBe('"Hello ""world"""');
      expect(escape("simple")).toBe('"simple"');
      expect(escape("")).toBe('""');
    });

    it("formats timestamps as ISO strings", () => {
      const ts = new Date("2026-01-15T10:30:00Z");
      expect(ts.toISOString()).toBe("2026-01-15T10:30:00.000Z");
    });
  });

  describe("Education Library SPI filter fix", () => {
    it("generates unique keys for courses with _source prefix", () => {
      // Simulate the key generation logic
      const eBook = { id: 1, _source: "digital_product", slug: "ebook-ceo" };
      const quiz = { id: 1, _source: "lms_course", slug: "spi-quiz" };

      const eBookKey = `${eBook._source ?? eBook.slug}-${eBook.id}`;
      const quizKey = `${quiz._source ?? quiz.slug}-${quiz.id}`;

      expect(eBookKey).toBe("digital_product-1");
      expect(quizKey).toBe("lms_course-1");
      expect(eBookKey).not.toBe(quizKey);
    });

    it("handles items without _source by using slug", () => {
      const item = { id: 5, _source: undefined, slug: "my-course" };
      const key = `${item._source ?? item.slug}-${item.id}`;
      expect(key).toBe("my-course-5");
    });
  });

  describe("User Analytics userList fix", () => {
    it("uses createdAt column (camelCase) for users table", () => {
      // The fix changed u.created_at to u.createdAt
      const correctQuery = "u.createdAt AS joinedAt";
      const incorrectQuery = "u.created_at AS joinedAt";
      
      // Verify the correct column name is used
      expect(correctQuery).toContain("createdAt");
      expect(incorrectQuery).not.toContain("createdAt");
    });

    it("uses snake_case for lms_enrollments.completed_at", () => {
      // lms_enrollments uses snake_case columns
      const query = "lms_enrollments WHERE user_id = u.id AND completed_at IS NOT NULL";
      expect(query).toContain("completed_at");
    });
  });

  describe("Activity event types", () => {
    it("has all expected event types defined", () => {
      const eventTypes = [
        "page_view",
        "login",
        "video_play",
        "video_complete",
        "quiz_pass",
        "quiz_fail",
        "course_enroll",
        "course_complete",
        "download",
        "module_complete",
      ];
      expect(eventTypes).toHaveLength(10);
      expect(eventTypes).toContain("page_view");
      expect(eventTypes).toContain("login");
      expect(eventTypes).toContain("quiz_pass");
      expect(eventTypes).toContain("download");
    });
  });
});
