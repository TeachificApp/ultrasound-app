-- Printful print-on-demand integration for physical products
ALTER TABLE `physical_products`
  ADD COLUMN `printful_enabled` tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `printful_store_id` int DEFAULT NULL,
  ADD COLUMN `printful_sync_product_id` int DEFAULT NULL,
  ADD COLUMN `printful_sync_variant_id` int DEFAULT NULL;

ALTER TABLE `physical_product_orders`
  ADD COLUMN `printful_order_id` varchar(64) DEFAULT NULL,
  ADD COLUMN `printful_status` varchar(64) DEFAULT NULL,
  ADD COLUMN `printful_error` text DEFAULT NULL,
  ADD COLUMN `printful_submitted_at` timestamp NULL DEFAULT NULL;
