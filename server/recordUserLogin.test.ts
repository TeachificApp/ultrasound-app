import { describe, it, expect } from "vitest";
import type { Request } from "express";
import { getRequestClientInfo } from "./lib/recordUserLogin";

describe("getRequestClientInfo", () => {
  it("extracts IP and user agent from request headers", () => {
    const req = {
      headers: {
        "x-forwarded-for": "203.0.113.1, 10.0.0.1",
        "user-agent": "Mozilla/5.0 Test Browser",
      },
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as Request;

    const info = getRequestClientInfo(req);
    expect(info.ipAddress).toBe("203.0.113.1");
    expect(info.userAgent).toBe("Mozilla/5.0 Test Browser");
  });

  it("falls back to socket remote address", () => {
    const req = {
      headers: {},
      socket: { remoteAddress: "192.168.1.5" },
    } as unknown as Request;

    expect(getRequestClientInfo(req).ipAddress).toBe("192.168.1.5");
  });
});
