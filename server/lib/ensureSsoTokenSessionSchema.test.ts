import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ensureSsoTokenSessionSchema,
  SSO_TOKEN_SESSION_COLUMN,
} from "./ensureSsoTokenSessionSchema";

describe("ensureSsoTokenSessionSchema", () => {
  it("adds the missing additive session binding without touching existing tokens", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ COLUMN_NAME: "id" }, { COLUMN_NAME: "user_id" }], []])
      .mockResolvedValue([[], []]);

    const result = await ensureSsoTokenSessionSchema({ execute } as never);

    expect(result).toEqual({ applied: true });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(SSO_TOKEN_SESSION_COLUMN.ddl).toContain("session_id");
    expect(execute.mock.calls[1]).toHaveLength(1);
  });

  it("does not alter a compatible Railway table", async () => {
    const execute = vi.fn().mockResolvedValueOnce([
      [{ COLUMN_NAME: "id" }, { COLUMN_NAME: SSO_TOKEN_SESSION_COLUMN.name }],
      [],
    ]);

    await expect(ensureSsoTokenSessionSchema({ execute } as never)).resolves.toEqual({ applied: false });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("runs before the server begins accepting SSO exchange requests", async () => {
    const source = await readFile(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
    expect(source).toContain("ensureSsoTokenSessionSchema");
    expect(source.lastIndexOf("ensureSsoTokenSessionSchema")).toBeLessThan(source.lastIndexOf("server.listen(port"));
  });
});
