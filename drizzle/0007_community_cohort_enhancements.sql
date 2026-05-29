-- Community enhancements: sort order, restricted type, icon, linked access, admin profiles
-- Community members: pending approval status, admin profile link
-- Community posts: admin profile link
-- New: lms_cohort_groups and lms_cohort_group_enrollments tables

-- 1. Alter communities table
ALTER TABLE `communities`
  MODIFY COLUMN `access_type` ENUM('free','paid','restricted') NOT NULL DEFAULT 'free',
  ADD COLUMN `sort_order` INT NOT NULL DEFAULT 0 AFTER `access_type`,
  ADD COLUMN `icon_image` TEXT AFTER `sort_order`,
  ADD COLUMN `linked_access_items` LONGTEXT AFTER `icon_image`;

-- 2. Alter community_members table
ALTER TABLE `community_members`
  ADD COLUMN `member_status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  ADD COLUMN `admin_profile_id` INT;

-- 3. Alter community_posts table
ALTER TABLE `community_posts`
  ADD COLUMN `admin_profile_id` INT AFTER `user_id`;

-- 4. Create community_admin_profiles table
CREATE TABLE IF NOT EXISTS `community_admin_profiles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `community_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `avatar_url` TEXT,
  `bio` TEXT,
  `created_by_user_id` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 5. Create lms_cohort_groups table
CREATE TABLE IF NOT EXISTS `lms_cohort_groups` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `course_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `start_date` TIMESTAMP NULL,
  `end_date` TIMESTAMP NULL,
  `enrollment_close_date` TIMESTAMP NULL,
  `max_students` INT,
  `status` ENUM('draft','open','active','completed','archived') NOT NULL DEFAULT 'draft',
  `page_blocks` LONGTEXT,
  `is_featured_on_landing` BOOLEAN NOT NULL DEFAULT FALSE,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 6. Create lms_cohort_group_enrollments table
CREATE TABLE IF NOT EXISTS `lms_cohort_group_enrollments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cohort_group_id` INT NOT NULL,
  `enrollment_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `course_id` INT NOT NULL,
  `joined_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
