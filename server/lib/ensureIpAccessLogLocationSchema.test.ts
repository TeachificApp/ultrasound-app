import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ensureIpAccessLogLocationSchema,
  IP_ACCESS_LOG_LOCATION_COLUMNS,
} from "./ensureIpAccessLogLocationSchema";

describe("ensureIpAccessLogLocationSchema", () => {
  it("adds only the missing additive IP-location columns", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ COLUMN_NAME: "id" }, { COLUMN_NAME: "user_id" }], []])
      .mockResolvedValue([[], []]);
    const result = await ensureIpAccessLogLocationSchema({ execute } as never);

    expect(result.applied).toEqual(IP_ACCESS_LOG_LOCATION_COLUMNS.map((column) => column.name));
    expect(execute).toHaveBeenCalledTimes(1 + IP_ACCESS_LOG_LOCATION_COLUMNS.length);
  });

  it("performs no ALTER when the Railway table already has every field", async () => {
    const execute = vi.fn().mockResolvedValueOnce([
      IP_ACCESS_LOG_LOCATION_COLUMNS.map((column) => ({ COLUMN_NAME: column.name })),
      [],
    ]);
    const result = await ensureIpAccessLogLocationSchema({ execute } as never);

    expect(result).toEqual({ applied: [] });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("runs before the server begins accepting requests", async () => {
    const source = await readFile(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
    expect(source).toContain("ensureIpAccessLogLocationSchema");
    expect(source.lastIndexOf("ensureIpAccessLogLocationSchema")).toBeLessThan(source.lastIndexOf("server.listen(port"));
  });
});
