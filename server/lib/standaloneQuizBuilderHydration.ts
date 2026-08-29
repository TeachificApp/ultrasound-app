import { and, eq, inArray } from "drizzle-orm";
import { standaloneQuizQuestions, questionBank } from "../../drizzle/schema";
import type { QuizFile } from "./quizBuilderConfig";
import {
  builderQuestionFromQuestionBank,
  mergeCanonicalBuilderQuestion,
  questionBankIdFromBuilderId,
} from "./visualBuilderQuestionBankSync";

export const HYDRATE_QUESTION_BANK_BATCH_SIZE = 100;

type HydrateOptions = {
  /** When set, only fetch and merge these Question Bank IDs (reduces query size for large quizzes). */
  onlyBankIds?: number[];
};

/** Hydrate linked builder questions from their canonical Question Bank record before learner delivery or grading. */
export async function hydrateBuilderConfigFromQuestionBank(
  db: any,
  quizId: number,
  config: QuizFile,
  opts?: HydrateOptions,
): Promise<QuizFile> {
  let bankIds = config.questions
    .map((question) => questionBankIdFromBuilderId((question as { id?: unknown }).id))
    .filter((id): id is number => id !== null);

  if (opts?.onlyBankIds?.length) {
    const allowed = new Set(opts.onlyBankIds);
    bankIds = bankIds.filter((id) => allowed.has(id));
  }

  if (bankIds.length === 0) return config;

  const links: Array<{ sqq: typeof standaloneQuizQuestions.$inferSelect; qb: typeof questionBank.$inferSelect }> = [];
  for (let offset = 0; offset < bankIds.length; offset += HYDRATE_QUESTION_BANK_BATCH_SIZE) {
    const chunk = bankIds.slice(offset, offset + HYDRATE_QUESTION_BANK_BATCH_SIZE);
    const rows = await db
      .select({ sqq: standaloneQuizQuestions, qb: questionBank })
      .from(standaloneQuizQuestions)
      .innerJoin(questionBank, eq(standaloneQuizQuestions.questionBankId, questionBank.id))
      .where(and(eq(standaloneQuizQuestions.quizId, quizId), inArray(standaloneQuizQuestions.questionBankId, chunk)));
    links.push(...rows);
  }

  const canonicalById = new Map(
    links.map((row) => [`bank-${row.qb.id}`, builderQuestionFromQuestionBank(row)]),
  );
  return {
    ...config,
    questions: config.questions.map((question) => {
      const canonical = canonicalById.get(String((question as { id?: unknown }).id));
      return canonical
        ? mergeCanonicalBuilderQuestion(question as Record<string, unknown>, canonical)
        : question;
    }),
  } as QuizFile;
}
