export type ShiftableSchedule = {
  startDate: Date | string | null | undefined;
  endDate?: Date | string | null | undefined;
  enrollmentCloseDate?: Date | string | null | undefined;
};

export type DuplicatedSchedule = {
  startDate: Date;
  endDate: Date | null;
  enrollmentCloseDate: Date | null;
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Preserves the relative schedule of a run when its new start date is chosen.
 * For example, an assignment due five days after the old cohort start remains
 * due five days after the copied cohort start.
 */
export function shiftDateFromStart(
  value: Date | string | null | undefined,
  originalStart: Date | string | null | undefined,
  newStart: Date | string,
): Date | null {
  const source = asDate(value);
  const sourceStart = asDate(originalStart);
  const destinationStart = asDate(newStart);
  if (!source || !destinationStart) return null;
  if (!sourceStart) return source;
  return new Date(destinationStart.getTime() + (source.getTime() - sourceStart.getTime()));
}

export function duplicateScheduleFromStart(
  source: ShiftableSchedule,
  newStart: Date | string,
): DuplicatedSchedule {
  const startDate = asDate(newStart);
  if (!startDate) throw new Error("A valid new start date is required.");
  return {
    startDate,
    endDate: shiftDateFromStart(source.endDate, source.startDate, startDate),
    enrollmentCloseDate: shiftDateFromStart(source.enrollmentCloseDate, source.startDate, startDate),
  };
}
