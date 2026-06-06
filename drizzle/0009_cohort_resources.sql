-- Cohort resource cards (links + downloads) for My Cohort Resources tab
CREATE TABLE IF NOT EXISTS `lms_cohort_resources` (
  `id` int AUTO_INCREMENT NOT NULL,
  `course_id` int NOT NULL,
  `cohort_group_id` int,
  `title` varchar(255) NOT NULL,
  `description` text,
  `card_image_url` text,
  `action_type` enum('link','download') NOT NULL DEFAULT 'link',
  `link_url` text,
  `download_source` enum('upload','media_repo','download_product'),
  `file_url` text,
  `file_key` varchar(512),
  `file_name` varchar(512),
  `media_asset_id` int,
  `download_product_id` int,
  `status` enum('draft','published') NOT NULL DEFAULT 'draft',
  `position` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `lms_cohort_resources_id` PRIMARY KEY(`id`)
);
