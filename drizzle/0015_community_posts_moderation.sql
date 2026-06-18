-- Community posts: moderation + post type columns used by communityRouter

ALTER TABLE `community_posts`
  ADD COLUMN `post_type` ENUM('text','image','video','poll','case_study') NOT NULL DEFAULT 'text' AFTER `attachments`,
  ADD COLUMN `view_count` INT NOT NULL DEFAULT 0 AFTER `reaction_count`,
  ADD COLUMN `is_locked` BOOLEAN NOT NULL DEFAULT FALSE AFTER `view_count`,
  ADD COLUMN `is_hidden` BOOLEAN NOT NULL DEFAULT FALSE AFTER `is_locked`;
