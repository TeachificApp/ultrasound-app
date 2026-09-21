-- Compatibility for the already-deployed Study Group server revision.
-- That revision writes `stripe_current_period_end`; current code uses
-- `current_period_end`. Keeping both nullable columns is additive and lets
-- active requests complete while GitHub/Railway deployment converges.
ALTER TABLE `study_groups`
  ADD COLUMN `stripe_current_period_end` TIMESTAMP NULL AFTER `current_period_end`;
