-- Add account suspension fields to users table
ALTER TABLE `users`
  ADD COLUMN `suspendedAt` timestamp NULL,
  ADD COLUMN `suspensionReason` varchar(500) NULL,
  ADD COLUMN `suspendedBy` int NULL;
