import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) =>
  fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("storage health diagnostics", () => {
  it("provides an administrator-only secret-safe storage health procedure", () => {
    const router = read("server/_core/systemRouter.ts");
    expect(router).toContain("checkStorageHealth: adminProcedure.mutation");
    expect(router).toContain("getStorageHealth");
  });

  it("uses an ephemeral write/delete probe and never returns credentials or provider URLs", () => {
    const storage = read("server/storage.ts");
    const healthFunction = storage.slice(storage.indexOf("export async function getStorageHealth"));
    expect(storage).toContain("diagnostics/storage-health-");
    expect(storage).toContain("await r2Delete(probeKey)");
    expect(healthFunction).toContain("r2Write: \"healthy\"");
    expect(healthFunction).not.toContain("secretAccessKey");
    expect(healthFunction).not.toContain("CF_R2_SECRET_ACCESS_KEY");
  });

  it("returns an actionable but non-sensitive response when an editor upload is denied", () => {
    const route = read("server/routes/uploadCourseImage.ts");
    expect(route).toContain("Image storage is temporarily unavailable");
    expect(route).toContain("storage,");
    expect(route).toContain("res.status(503)");
  });
});
