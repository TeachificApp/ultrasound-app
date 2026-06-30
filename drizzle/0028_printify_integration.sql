-- Printify print-on-demand integration
ALTER TABLE `physical_products`
  ADD COLUMN `printify_enabled` tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `printify_shop_id` int DEFAULT NULL,
  ADD COLUMN `printify_product_id` varchar(64) DEFAULT NULL,
  ADD COLUMN `printify_variant_id` int DEFAULT NULL;

ALTER TABLE `physical_product_orders`
  ADD COLUMN `printify_order_id` varchar(64) DEFAULT NULL,
  ADD COLUMN `printify_status` varchar(64) DEFAULT NULL,
  ADD COLUMN `printify_error` text DEFAULT NULL,
  ADD COLUMN `printify_submitted_at` timestamp NULL DEFAULT NULL;
