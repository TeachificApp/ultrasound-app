-- Processing metadata for revenue-share ledger entries.
-- Additive only: enables safe distinction between checkout splits, Stripe transfers,
-- and deliberate manual payouts without changing any existing payout amounts.
ALTER TABLE revenue_share_ledger
  ADD COLUMN IF NOT EXISTS process_method ENUM('payment_time', 'stripe_transfer', 'manual') NULL AFTER paid_at,
  ADD COLUMN IF NOT EXISTS auto_processed_at BIGINT NULL AFTER process_method,
  ADD COLUMN IF NOT EXISTS processed_by_user_id INT NULL AFTER auto_processed_at;
