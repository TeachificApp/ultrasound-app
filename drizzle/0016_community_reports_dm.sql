-- Community reports: community scope + DM message reports

ALTER TABLE `community_reports`
  ADD COLUMN `community_id` INT NULL AFTER `target_id`;

ALTER TABLE `community_reports`
  MODIFY COLUMN `target_type` ENUM('post','comment','user','dm_message') NOT NULL;
