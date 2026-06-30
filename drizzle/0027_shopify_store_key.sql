-- Shopify multi-store product linking
ALTER TABLE `physical_products`
  ADD COLUMN `shopify_store_key` varchar(64) DEFAULT 'default';
