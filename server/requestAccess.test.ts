/**
 * Tests for system.requestAccess tRPC mutation.
 *
 * The mutation should:
 *  - Require an authenticated user (UNAUTHORIZED for unauthenticated callers)
 *  - Call notifyOwner with a formatted message containing user details
 *  - Return { success: true } when notification is delivered
 *  - Return { success: false } when the notification service is unavailable
 *  - Include the requestedRoute in the notification content
 *  - Include an optional user message in the notification content
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 42,
    openId: "test-open-id",
    email: "testuser@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    displayName: null,
    avatarUrl: null,
    coverUrl: null,
    bio: null,
    credentials: null,
    specialty: null,
    yearsExperience: null,
    location: null,
    website: null,
    isPublicProfile: true,
    hubAccepted: false,
    isPremium: false,
    followersCount: 0,
    followingCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createCtx(user: AuthenticatedUser | null = null): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// ─── Mock notifyOwner ─────────────────────────────────────────────────────────

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(),
}));

import { notifyOwner } from "./_core/notification";
const mockNotifyOwner = vi.mocked(notifyOwner);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("system.requestAccess", () => {
  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(
      caller.system.requestAccess({ requestedRoute: "/accreditation" })
    ).rejects.toThrow(TRPCError);
  });

  it("calls notifyOwner with user name and email in content", async () => {
    mockNotifyOwner.mockResolvedValue(true);
    const user = createUser({ name: "Jane Smith", email: "jane@lab.com" });
    const caller = appRouter.createCaller(createCtx(user));

    await caller.system.requestAccess({ requestedRoute: "/accreditation" });

    expect(mockNotifyOwner).toHaveBeenCalledOnce();
    const [payload] = mockNotifyOwner.mock.calls[0]!;
    expect(payload.title).toContain("Jane Smith");
    expect(payload.content).toContain("jane@lab.com");
    expect(payload.content).toContain("/accreditation");
  });

  it("returns { success: true } when notification is delivered", async () => {
    mockNotifyOwner.mockResolvedValue(true);
    const caller = appRouter.createCaller(createCtx(createUser()));

    const result = await caller.system.requestAccess({ requestedRoute: "/lab-admin" });

    expect(result).toEqual({ success: true });
  });

  it("returns { success: false } when notification service is unavailable", async () => {
    mockNotifyOwner.mockResolvedValue(false);
    const caller = appRouter.createCaller(createCtx(createUser()));

    const result = await caller.system.requestAccess({ requestedRoute: "/lab-admin" });

    expect(result).toEqual({ success: false });
  });

  it("includes optional user message in notification content", async () => {
    mockNotifyOwner.mockResolvedValue(true);
    const caller = appRouter.createCaller(createCtx(createUser()));

    await caller.system.requestAccess({
      requestedRoute: "/accreditation",
      message: "I am the lab director and need access.",
    });

    const [payload] = mockNotifyOwner.mock.calls[0]!;
    expect(payload.content).toContain("I am the lab director and need access.");
  });

  it("omits message field from content when not provided", async () => {
    mockNotifyOwner.mockResolvedValue(true);
    const caller = appRouter.createCaller(createCtx(createUser()));

    await caller.system.requestAccess({ requestedRoute: "/accreditation" });

    const [payload] = mockNotifyOwner.mock.calls[0]!;
    expect(payload.content).not.toContain("Message:");
  });

  it("includes user ID in notification content", async () => {
    mockNotifyOwner.mockResolvedValue(true);
    const user = createUser({ id: 99 });
    const caller = appRouter.createCaller(createCtx(user));

    await caller.system.requestAccess({ requestedRoute: "/platform-admin" });

    const [payload] = mockNotifyOwner.mock.calls[0]!;
    expect(payload.content).toContain("99");
  });

  it("uses default route '/' when requestedRoute is not provided", async () => {
    mockNotifyOwner.mockResolvedValue(true);
    const caller = appRouter.createCaller(createCtx(createUser()));

    // requestedRoute has a default of "/"
    await caller.system.requestAccess({});

    const [payload] = mockNotifyOwner.mock.calls[0]!;
    expect(payload.content).toContain("Requested Route: /");
  });
});
