import { describe, it, expect, vi, beforeEach } from "vitest";
import { insertQuestionBankFolder, selectQuestionBankFolders } from "./questionBankFolderQueries";

vi.mock("./ensureQuestionBankFoldersSchema", () => ({
  ensureQuestionBankFoldersSchema: vi.fn().mockResolvedValue({ applied: false, hadSortOrder: false }),
}));

describe("questionBankFolderQueries legacy fallback", () => {
  const execute = vi.fn();
  const select = vi.fn();
  const from = vi.fn();
  const orderBy = vi.fn();
  const where = vi.fn();
  const insert = vi.fn();
  const values = vi.fn();
  const returningId = vi.fn();

  const db = {
    execute,
    select,
    insert,
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    execute.mockResolvedValue([[{ COLUMN_NAME: "name" }, { COLUMN_NAME: "color" }], []]);
    select.mockReturnValue({ from });
    from.mockReturnValue({ where, orderBy });
    where.mockReturnValue({ orderBy });
    orderBy.mockResolvedValue([{ id: 1, name: "Adult Echo", sortOrder: 0 }]);
    insert.mockReturnValue({ values });
    values.mockReturnValue({ $returningId: returningId });
    returningId.mockResolvedValue([{ id: 99 }]);
  });

  it("lists folders without sort_order column", async () => {
    const folders = await selectQuestionBankFolders(db);
    expect(folders).toHaveLength(1);
    expect(folders[0]?.name).toBe("Adult Echo");
  });

  it("creates folders without sort_order column", async () => {
    const id = await insertQuestionBankFolder(db, { name: "New Folder", createdByAdminId: 1 });
    expect(id).toBe(99);
    expect(values).toHaveBeenCalledWith(expect.not.objectContaining({ sortOrder: expect.anything() }));
  });
});
