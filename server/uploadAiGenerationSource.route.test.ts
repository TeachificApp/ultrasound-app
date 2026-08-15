import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";

const mocks = vi.hoisted(() => ({ authenticateRequest: vi.fn(), storagePut: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));

import { registerUploadAiGenerationSourceRoute } from "./routes/uploadAiGenerationSource";

let activeServer: any;
afterEach(async () => {
  if (activeServer) await new Promise<void>(resolve => activeServer.close(() => resolve()));
  activeServer = null;
  vi.clearAllMocks();
});

async function startRoute() {
  const app = express();
  registerUploadAiGenerationSourceRoute(app);
  activeServer = app.listen(0);
  await new Promise<void>(resolve => activeServer.once("listening", resolve));
  const { port } = activeServer.address();
  return `http://127.0.0.1:${port}`;
}

describe("POST /api/upload-ai-generation-source", () => {
  it("accepts an authenticated admin PDF and returns source metadata", async () => {
    mocks.authenticateRequest.mockResolvedValue({ id: 7, role: "admin" });
    mocks.storagePut.mockResolvedValue({ key: "ai-generation-sources/7/source.pdf", url: "https://files.example/source.pdf" });
    const body = new FormData();
    body.append("file", new Blob(["%PDF sample"], { type: "application/pdf" }), "reference.pdf");
    const response = await fetch(`${await startRoute()}/api/upload-ai-generation-source`, { method: "POST", body });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ sourceFile: { url: "https://files.example/source.pdf", mimeType: "application/pdf", name: "reference.pdf" } });
    expect(mocks.storagePut).toHaveBeenCalledWith(expect.stringContaining("ai-generation-sources/7/"), expect.any(Buffer), "application/pdf");
  });

  it("rejects non-admin uploads and unsupported source MIME types", async () => {
    mocks.authenticateRequest.mockResolvedValue({ id: 8, role: "user" });
    const imageBody = new FormData();
    imageBody.append("file", new Blob(["image"], { type: "image/png" }), "scan.png");
    const unauthorized = await fetch(`${await startRoute()}/api/upload-ai-generation-source`, { method: "POST", body: imageBody });
    expect(unauthorized.status).toBe(401);

    mocks.authenticateRequest.mockResolvedValue({ id: 7, role: "admin" });
    const zipBody = new FormData();
    zipBody.append("file", new Blob(["zip"], { type: "application/zip" }), "source.zip");
    const invalid = await fetch(`${await startRoute()}/api/upload-ai-generation-source`, { method: "POST", body: zipBody });
    expect(invalid.status).toBe(400);
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });
});
