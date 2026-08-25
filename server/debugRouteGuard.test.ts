import { describe, expect, it, vi, afterEach } from "vitest";
import type { Request, Response } from "express";
import { denyUnlessDebugAuthorized, isDebugRouteAuthorized } from "./lib/debugRouteGuard";

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    query: {},
    ...overrides,
  } as Request;
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode: number; body: unknown };
}

describe("debugRouteGuard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows debug routes outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isDebugRouteAuthorized(mockReq())).toBe(true);
    expect(denyUnlessDebugAuthorized(mockReq(), mockRes())).toBe(false);
  });

  it("blocks debug routes in production without a configured secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEBUG_ADMIN_SECRET", "");
    expect(isDebugRouteAuthorized(mockReq())).toBe(false);
    const res = mockRes();
    expect(denyUnlessDebugAuthorized(mockReq(), res)).toBe(true);
    expect(res.statusCode).toBe(404);
  });

  it("allows debug routes in production when the secret matches", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEBUG_ADMIN_SECRET", "test-secret");
    const req = mockReq({ headers: { "x-debug-secret": "test-secret" } });
    expect(isDebugRouteAuthorized(req)).toBe(true);
  });
});
