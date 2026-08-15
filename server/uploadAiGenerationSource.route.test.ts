import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";

const mocks = vi.hoisted(() => ({ authenticateRequest: vi.fn(), storagePut: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));

import { createAiGenerationSourceRouter, registerUploadAiGenerationSourceRoute } from "./routes/uploadAiGenerationSource";
import { AI_SOURCE_FILE_MAX_BYTES } from "./lib/aiSourceFile";

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

async function startRouteWithLimit(maxBytes: number) {
  const app = express();
  app.use(createAiGenerationSourceRouter(maxBytes));
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

  it("enforces the configured source upload size limit before storage", async () => {
    mocks.authenticateRequest.mockResolvedValue({ id: 7, role: "admin" });
    const body = new FormData();
    body.append("file", new Blob(["12345"], { type: "application/pdf" }), "too-large.pdf");
    const response = await fetch(`${await startRouteWithLimit(4)}/api/upload-ai-generation-source`, { method: "POST", body });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("0 MB or smaller") });
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("accepts a source file at the real 50 MB boundary and rejects one byte above it", async () => {
    mocks.authenticateRequest.mockResolvedValue({ id: 7, role: "admin" });
    mocks.storagePut.mockResolvedValue({ key: "ai-generation-sources/7/boundary.pdf", url: "https://files.example/boundary.pdf" });
    const withinLimit = new FormData();
    withinLimit.append("file", new Blob([new Uint8Array(AI_SOURCE_FILE_MAX_BYTES)], { type: "application/pdf" }), "boundary.pdf");
    const accepted = await fetch(`${await startRoute()}/api/upload-ai-generation-source`, { method: "POST", body: withinLimit });
    expect(accepted.status).toBe(200);

    const overLimit = new FormData();
    overLimit.append("file", new Blob([new Uint8Array(AI_SOURCE_FILE_MAX_BYTES + 1)], { type: "application/pdf" }), "too-large.pdf");
    const rejected = await fetch(`${await startRoute()}/api/upload-ai-generation-source`, { method: "POST", body: overLimit });
    expect(rejected.status).toBe(400);
    await expect(rejected.json()).resolves.toMatchObject({ error: expect.stringContaining("50 MB") });
  });
});
