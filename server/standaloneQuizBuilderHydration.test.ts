import { describe, expect, it, vi } from "vitest";
import {
  HYDRATE_QUESTION_BANK_BATCH_SIZE,
  hydrateBuilderConfigFromQuestionBank,
} from "./lib/standaloneQuizBuilderHydration";

describe("standaloneQuizBuilderHydration", () => {
  it("batches large Question Bank hydration queries", async () => {
    const select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    const db = { select };
    const bankIds = Array.from({ length: 250 }, (_, index) => index + 1);
    const config = {
      meta: { title: "RPhS" },
      questions: bankIds.map((id) => ({ id: `bank-${id}`, stem: `Q${id}` })),
    };

    await hydrateBuilderConfigFromQuestionBank(db, 30001, config as any);

    expect(select).toHaveBeenCalledTimes(Math.ceil(bankIds.length / HYDRATE_QUESTION_BANK_BATCH_SIZE));
  });

  it("hydrates only the requested bank ids", async () => {
    const where = vi.fn().mockResolvedValue([]);
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({ where }),
        }),
      }),
    };
    const config = {
      meta: { title: "RPhS" },
      questions: [
        { id: "bank-1", stem: "One" },
        { id: "bank-2", stem: "Two" },
      ],
    };

    await hydrateBuilderConfigFromQuestionBank(db, 30001, config as any, { onlyBankIds: [2] });

    expect(where).toHaveBeenCalledTimes(1);
  });
});
