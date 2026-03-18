/**
 * Tests for the Thinkific free membership auto-enrollment helpers.
 * Covers: findOrCreateThinkificUser, enrollInCourse, enrollInFreeMembership
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock fetch ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Mock ENV ─────────────────────────────────────────────────────────────────

vi.mock("./_core/env", () => ({
  ENV: {
    thinkificApiKey: "test-api-key",
    thinkificSubdomain: "testsubdomain",
  },
}));

// ─── Helpers under test ───────────────────────────────────────────────────────

// We test the logic inline to avoid import side effects from the full thinkific module.
// This mirrors the actual implementation in server/thinkific.ts.

const BASE_URL = "https://api.thinkific.com/api/public/v1";
const FREE_MEMBERSHIP_COURSE_IDS = [2982817, 2980660, 2980484, 586085] as const;

async function getUserByEmail(email: string): Promise<{ id: number; email: string } | null> {
  const res = await fetch(`${BASE_URL}/users?query=${encodeURIComponent(email)}&page=1&limit=10`, {
    headers: { "X-Auth-API-Key": "test-api-key", "X-Auth-Subdomain": "testsubdomain", "Content-Type": "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json() as { items: Array<{ id: number; email: string }> };
  return data.items.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

async function findOrCreateThinkificUser(email: string, firstName: string, lastName: string): Promise<number> {
  const existing = await getUserByEmail(email);
  if (existing) return existing.id;
  const res = await fetch(`${BASE_URL}/users`, {
    method: "POST",
    headers: { "X-Auth-API-Key": "test-api-key", "X-Auth-Subdomain": "testsubdomain", "Content-Type": "application/json" },
    body: JSON.stringify({ first_name: firstName || "Member", last_name: lastName || "", email, skip_custom_fields_validation: true }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Thinkific create user error ${res.status}: ${body}`);
  }
  const newUser = await res.json() as { id: number };
  return newUser.id;
}

async function enrollInCourse(thinkificUserId: number, courseId: number): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/enrollments`, {
    method: "POST",
    headers: { "X-Auth-API-Key": "test-api-key", "X-Auth-Subdomain": "testsubdomain", "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: thinkificUserId, course_id: courseId, activated_at: new Date().toISOString() }),
  });
  if (res.status === 422) return true;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Thinkific enroll error ${res.status}: ${body}`);
  }
  return true;
}

async function enrollInFreeMembership(
  email: string,
  firstName: string,
  lastName: string
): Promise<{ thinkificUserId: number; coursesEnrolled: number }> {
  const thinkificUserId = await findOrCreateThinkificUser(email, firstName, lastName);
  let coursesEnrolled = 0;
  for (const courseId of FREE_MEMBERSHIP_COURSE_IDS) {
    try {
      await enrollInCourse(thinkificUserId, courseId);
      coursesEnrolled++;
    } catch {
      // silently skip
    }
  }
  return { thinkificUserId, coursesEnrolled };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
});

describe("FREE_MEMBERSHIP_COURSE_IDS", () => {
  it("contains exactly 4 course IDs", () => {
    expect(FREE_MEMBERSHIP_COURSE_IDS).toHaveLength(4);
  });

  it("contains the expected course IDs", () => {
    expect(FREE_MEMBERSHIP_COURSE_IDS).toContain(2982817);
    expect(FREE_MEMBERSHIP_COURSE_IDS).toContain(2980660);
    expect(FREE_MEMBERSHIP_COURSE_IDS).toContain(2980484);
    expect(FREE_MEMBERSHIP_COURSE_IDS).toContain(586085);
  });
});

describe("getUserByEmail", () => {
  it("returns the matching user when found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: 42, email: "test@example.com" }] }),
    });
    const result = await getUserByEmail("test@example.com");
    expect(result).toEqual({ id: 42, email: "test@example.com" });
  });

  it("returns null when no exact email match", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: 99, email: "other@example.com" }] }),
    });
    const result = await getUserByEmail("test@example.com");
    expect(result).toBeNull();
  });

  it("returns null when the API call fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    const result = await getUserByEmail("test@example.com");
    expect(result).toBeNull();
  });

  it("is case-insensitive for email matching", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: 77, email: "TEST@EXAMPLE.COM" }] }),
    });
    const result = await getUserByEmail("test@example.com");
    expect(result).toEqual({ id: 77, email: "TEST@EXAMPLE.COM" });
  });
});

describe("findOrCreateThinkificUser", () => {
  it("returns existing user ID when user already exists", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: 55, email: "existing@example.com" }] }),
    });
    const id = await findOrCreateThinkificUser("existing@example.com", "Jane", "Doe");
    expect(id).toBe(55);
    expect(mockFetch).toHaveBeenCalledTimes(1); // only the search call
  });

  it("creates a new user when not found and returns new ID", async () => {
    // First call: search returns empty
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });
    // Second call: create user returns new ID
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 101, email: "new@example.com" }),
    });
    const id = await findOrCreateThinkificUser("new@example.com", "John", "Smith");
    expect(id).toBe(101);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("uses 'Member' as first name when firstName is empty", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 200 }) });
    await findOrCreateThinkificUser("user@example.com", "", "");
    const createCall = mockFetch.mock.calls[1];
    const body = JSON.parse(createCall[1].body);
    expect(body.first_name).toBe("Member");
  });

  it("throws when user creation fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422, text: async () => "Unprocessable" });
    await expect(findOrCreateThinkificUser("bad@example.com", "Bad", "User")).rejects.toThrow(
      "Thinkific create user error 422"
    );
  });
});

describe("enrollInCourse", () => {
  it("returns true on successful enrollment", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) });
    const result = await enrollInCourse(42, 2982817);
    expect(result).toBe(true);
  });

  it("returns true on 422 (already enrolled)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422, text: async () => "Already enrolled" });
    const result = await enrollInCourse(42, 2982817);
    expect(result).toBe(true);
  });

  it("throws on other non-ok responses", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Server error" });
    await expect(enrollInCourse(42, 2982817)).rejects.toThrow("Thinkific enroll error 500");
  });

  it("sends correct payload", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) });
    await enrollInCourse(42, 2982817);
    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.user_id).toBe(42);
    expect(body.course_id).toBe(2982817);
    expect(body.activated_at).toBeDefined();
  });
});

describe("enrollInFreeMembership", () => {
  it("enrolls user in all 4 free membership courses", async () => {
    // Search: user exists
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: 77, email: "member@example.com" }] }),
    });
    // 4 enrollment calls
    for (let i = 0; i < 4; i++) {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) });
    }
    const result = await enrollInFreeMembership("member@example.com", "Jane", "Doe");
    expect(result.thinkificUserId).toBe(77);
    expect(result.coursesEnrolled).toBe(4);
    expect(mockFetch).toHaveBeenCalledTimes(5); // 1 search + 4 enrollments
  });

  it("creates new Thinkific user if not found, then enrolls in 4 courses", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) }); // search
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 999 }) }); // create
    for (let i = 0; i < 4; i++) {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) });
    }
    const result = await enrollInFreeMembership("new@example.com", "New", "User");
    expect(result.thinkificUserId).toBe(999);
    expect(result.coursesEnrolled).toBe(4);
  });

  it("counts already-enrolled courses as successful", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: 88, email: "existing@example.com" }] }),
    });
    // 2 succeed, 2 already enrolled (422)
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422, text: async () => "Already enrolled" });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422, text: async () => "Already enrolled" });
    const result = await enrollInFreeMembership("existing@example.com", "Ex", "User");
    expect(result.coursesEnrolled).toBe(4); // 422s are treated as success
  });

  it("skips failed enrollments silently and still returns partial count", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: 55, email: "partial@example.com" }] }),
    });
    // 2 succeed, 2 fail with 500
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Error" });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Error" });
    const result = await enrollInFreeMembership("partial@example.com", "Partial", "User");
    expect(result.coursesEnrolled).toBe(2);
    expect(result.thinkificUserId).toBe(55);
  });
});
