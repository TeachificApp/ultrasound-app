-- Preserve imported SCORM media candidates and their source context for administrator reassignment.
-- Additive only; existing Question Bank media fields remain authoritative.
ALTER TABLE `question_bank`
  ADD COLUMN `media_candidates` TEXT NULL AFTER `feedback_video_url`;
