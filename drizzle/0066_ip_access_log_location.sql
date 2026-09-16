ALTER TABLE `ip_access_logs`
  ADD COLUMN `geo_lookup_status` varchar(16) NULL,
  ADD COLUMN `geo_country` varchar(96) NULL,
  ADD COLUMN `geo_region` varchar(128) NULL,
  ADD COLUMN `geo_city` varchar(128) NULL,
  ADD COLUMN `geo_postal_code` varchar(32) NULL,
  ADD COLUMN `geo_latitude` decimal(10,7) NULL,
  ADD COLUMN `geo_longitude` decimal(10,7) NULL,
  ADD COLUMN `geo_timezone` varchar(128) NULL,
  ADD COLUMN `geo_isp` varchar(255) NULL,
  ADD COLUMN `geo_organization` varchar(255) NULL,
  ADD COLUMN `geo_asn` varchar(32) NULL,
  ADD COLUMN `geo_resolved_at` timestamp NULL;
