-- BookVault fulfillment tracking on physical product orders
-- (physical_products.bookvault_enabled / bookvault_isbn are defined in drizzle schema)
ALTER TABLE `physical_product_orders`
  ADD COLUMN `bookvault_doc_ref` varchar(64) DEFAULT NULL,
  ADD COLUMN `bookvault_pod_ref` varchar(64) DEFAULT NULL,
  ADD COLUMN `bookvault_status` varchar(64) DEFAULT NULL,
  ADD COLUMN `bookvault_error` text DEFAULT NULL,
  ADD COLUMN `bookvault_submitted_at` timestamp NULL DEFAULT NULL;
