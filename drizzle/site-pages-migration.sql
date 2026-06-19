-- Site Pages CMS tables (run on TiDB/MySQL)
CREATE TABLE IF NOT EXISTS `site_pages` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `domain` varchar(255) NOT NULL,
  `slug` varchar(200) NOT NULL,
  `title` varchar(300) NOT NULL,
  `page_kind` enum('standard','home','legal_privacy','legal_terms','error_404','login','sales','system') NOT NULL DEFAULT 'standard',
  `status` enum('draft','published') NOT NULL DEFAULT 'draft',
  `blocks` longtext,
  `seo_title` varchar(255),
  `seo_description` text,
  `seo_image` varchar(512),
  `parent_page_id` int,
  `nav_sort_order` int NOT NULL DEFAULT 0,
  `show_in_header_nav` boolean NOT NULL DEFAULT false,
  `show_in_sidebar_nav` boolean NOT NULL DEFAULT false,
  `show_in_profile_nav` boolean NOT NULL DEFAULT false,
  `is_hidden_from_nav` boolean NOT NULL DEFAULT true,
  `is_home_page` boolean NOT NULL DEFAULT false,
  `external_url` varchar(512),
  `created_by_user_id` int,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `site_pages_domain_slug` (`domain`, `slug`)
);

CREATE TABLE IF NOT EXISTS `site_nav_menus` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `domain` varchar(255) NOT NULL,
  `menu_key` enum('header','sidebar','profile','footer') NOT NULL,
  `items_json` longtext NOT NULL,
  `updated_by_user_id` int,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `site_nav_menus_domain_key` (`domain`, `menu_key`)
);
