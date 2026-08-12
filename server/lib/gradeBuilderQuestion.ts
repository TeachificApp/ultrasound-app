/**
 * Server-side grading for visual builder questions (iSpring-style).
 */

interface McqData {
  choices: { id: string; text: string; correct: boolean }[];
  multiSelect: boolean;
}

interface TfData {
  correct: boolean;
}

import { orderQuestionOptions } from "./questionOptionOrder";

export function stableBuilderQuestionId(builderQuestionId: string): number {
  let h = 0;
  for (let i = 0; i < builderId.length; i++) {
    h = (Math.imul(31, h) + builderId.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

export function gradeBuilderAnswer(
  question: { id: string; type: string; data: unknown; points: number },
  givenAnswer: string
): boolean {
  let given: unknown;
  try {
    given = JSON.parse(givenAnswer);
  } catch {
    return false;
  }

  switch (question.type) {
    case "mcq":
    case "image_choice": {
      const data = question.data as McqData;
      const correctIds = data.choices.filter((c) => c.correct).map((c) => c.id).sort();
      const selected = (Array.isArray(given) ? given : [given]).map(String).sort();
      return JSON.stringify(correctIds) === JSON.stringify(selected);
    }
    case "tf": {
      const data = question.data as TfData;
      return given === data.correct;
    }
    case "numeric": {
      const data = question.data as { correctValue: number; tolerance: number; allowRange?: boolean; rangeMin?: number; rangeMax?: number };
      const val = Number(given);
      if (data.allowRange && data.rangeMin != null && data.rangeMax != null) {
        return val >= data.rangeMin && val <= data.rangeMax;
      }
      return Math.abs(val - data.correctValue) <= data.tolerance;
    }
    case "fill_blank": {
      const data = question.data as { blanks: { id: string; acceptedAnswers: string[]; caseSensitive: boolean }[] };
      const ans = given as Record<string, string>;
      return data.blanks.every((b) =>
        b.acceptedAnswers.some((acc) =>
          b.caseSensitive ? ans[b.id] === acc : (ans[b.id] || "").toLowerCase() === acc.toLowerCase()
        )
      );
    }
    case "dropdown": {
      const data = question.data as { blanks: { id: string; correctIndex: number }[] };
      const ans = given as Record<string, string>;
      return data.blanks.every((b) => Number(ans[b.id]) === b.correctIndex);
    }
    case "ordering": {
      const data = question.data as { items: { id: string }[] };
      const order = given as string[];
      return order.length === data.items.length && order.every((id, i) => id === data.items[i].id);
    }
    case "matching": {
      const data = question.data as { pairs: { id: string }[] };
      const ans = given as Record<string, string>;
      return data.pairs.every((p) => ans[p.id] === p.id);
    }
    default:
      return false;
  }
}

export function builderQuestionToPlayerPayload(
  q: {
    id: string;
    type: string;
    order: number;
    points: number;
    stem: string;
    image?: { url: string; alt: string } | null;
    video?: { url: string } | null;
    feedbackImage?: { url: string; alt: string } | null;
    feedbackVideo?: { url: string } | null;
    explanation?: string;
    feedback?: { correct?: string; incorrect?: string; partial?: string };
    branchRules?: unknown[];
    data: unknown;
    shuffleAnswerOptions?: boolean;
    backgroundImageUrl?: string;
    backgroundColor?: string;
  },
  showAnswers: boolean
) {
  const dataWithChoices = q.data as { choices?: unknown[] } | null;
  const playerData = q.shuffleAnswerOptions && Array.isArray(dataWithChoices?.choices)
    ? { ...dataWithChoices, choices: orderQuestionOptions(dataWithChoices.choices, true) }
    : q.data;

  return {
    builderQuestionId: q.id,
    questionBankId: stableBuilderQuestionId(q.id),
    points: q.points,
    question: q.stem,
    type: q.type,
    order: q.order,
    questionImageUrl: q.image?.url ?? null,
    questionVideoUrl: q.video?.url ?? null,
    feedbackImageUrl: q.feedbackImage?.url ?? null,
    feedbackVideoUrl: q.feedbackVideo?.url ?? null,
    backgroundImageUrl: q.backgroundImageUrl ?? null,
    backgroundColor: q.backgroundColor ?? null,
    feedback: q.feedback ?? null,
    branchRules: q.branchRules ?? [],
    data: playerData,
    ...(showAnswers
      ? {
          explanation: q.explanation,
          correctData: q.data,
        }
      : {}),
  };
}
