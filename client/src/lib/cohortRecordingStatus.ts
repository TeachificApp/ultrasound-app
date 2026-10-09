export const NEW_RECORDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type CohortRecordingWatchProgress = {
  firstPlayedAt?: Date | string | number | null;
  lastPlayedAt?: Date | string | number | null;
  playCount?: number | null;
  percentWatched?: number | null;
  completed?: boolean | null;
} | null | undefined;

export type CohortRecordingStatusSource = {
  /** The recording becomes newly visible at publication, otherwise its initial upload time. */
  publishedAt?: Date | string | number | null;
  createdAt?: Date | string | number | null;
};

function toTimestamp(value: Date | string | number | null | undefined): number | null {
  if (value == null) return null;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * A recording is considered watched as soon as the learner has started it. A
 * newly published replay remains marked New for seven days only while it has
 * not been watched by that learner.
 */
export function getCohortRecordingWatchStatus(
  recording: CohortRecordingStatusSource,
  progress: CohortRecordingWatchProgress,
  now = Date.now(),
) {
  const watched = Boolean(
    progress?.completed ||
    progress?.firstPlayedAt ||
    progress?.lastPlayedAt ||
    (progress?.playCount ?? 0) > 0 ||
    (progress?.percentWatched ?? 0) > 0,
  );
  const availableAt = toTimestamp(recording.publishedAt ?? recording.createdAt);
  const isNew = !watched && availableAt != null && now >= availableAt && now - availableAt <= NEW_RECORDING_WINDOW_MS;

  return { watched, isNew };
}
