-- Migration: Expand order_bumps trigger_type and bump_type enums
-- Adds 'webinar' and 'membership' as valid product types for both
-- the trigger product and the bump offer product.

ALTER TABLE `order_bumps`
  MODIFY COLUMN `trigger_type` ENUM('course','quiz','download','bundle','physical','cohort','webinar','membership') NOT NULL DEFAULT 'course',
  MODIFY COLUMN `bump_type` ENUM('course','quiz','download','bundle','physical','cohort','webinar','membership') NOT NULL DEFAULT 'download';
