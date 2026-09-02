export interface ImageLabelingTargetAssignment {
  id: string;
  labelId: string;
}

export type ImageLabelingAnswer = Record<string, string>;

export function isCompleteImageLabelingAnswer(
  targets: ImageLabelingTargetAssignment[],
  answer: unknown,
): answer is ImageLabelingAnswer {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return false;
  const selected = answer as ImageLabelingAnswer;
  return targets.length > 0 && targets.every((target) => typeof selected[target.id] === "string" && selected[target.id].length > 0);
}

export function gradeImageLabelingAnswer(
  targets: ImageLabelingTargetAssignment[],
  answer: unknown,
): boolean {
  if (!isCompleteImageLabelingAnswer(targets, answer)) return false;
  return targets.every((target) => answer[target.id] === target.labelId);
}
