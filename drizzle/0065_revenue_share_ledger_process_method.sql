-- Revenue share ledger: track auto vs manual processing and block duplicate payouts

ALTER TABLE `revenue_share_ledger`
  ADD COLUMN `process_method` ENUM('payment_time','stripe_transfer','manual') NULL DEFAULT NULL AFTER `paid_at`,
  ADD COLUMN `auto_processed_at` BIGINT NULL DEFAULT NULL AFTER `process_method`,
  ADD COLUMN `processed_by_user_id` INT NULL DEFAULT NULL AFTER `auto_processed_at`;

UPDATE `revenue_share_ledger`
  SET `process_method` = 'stripe_transfer', `auto_processed_at` = `paid_at`
  WHERE `status` = 'paid'
    AND `stripe_transfer_id` IS NOT NULL
    AND `process_method` IS NULL;

UPDATE `revenue_share_ledger`
  SET `process_method` = 'payment_time', `auto_processed_at` = `paid_at`
  WHERE `status` = 'paid'
    AND `stripe_transfer_id` IS NULL
    AND `process_method` IS NULL;
