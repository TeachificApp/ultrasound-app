-- Migration 0018: Add stripe_product_id column to bundles table
-- Applied directly via webdev_execute_sql on 2026-06-18
ALTER TABLE `bundles` ADD COLUMN `stripe_product_id` VARCHAR(255) NULL AFTER `installment_interval_days`;
