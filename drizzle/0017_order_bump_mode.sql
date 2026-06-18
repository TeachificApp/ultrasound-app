-- Migration 0017: Add bump_mode column to order_bumps table
-- Applied directly via webdev_execute_sql on 2026-06-18
ALTER TABLE `order_bumps` ADD COLUMN `bump_mode` ENUM('addon','upgrade') NOT NULL DEFAULT 'addon';
