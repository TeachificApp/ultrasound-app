-- TEACH slide masters: reusable layout templates with designer

CREATE TABLE IF NOT EXISTS `teach_slide_masters` (
  `id` int AUTO_INCREMENT NOT NULL,
  `owner_user_id` int NOT NULL,
  `name` varchar(300) NOT NULL,
  `description` text,
  `master_slides_data` longtext NOT NULL,
  `is_global` boolean NOT NULL DEFAULT false,
  `is_default_forced` boolean NOT NULL DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `teach_slide_masters_id` PRIMARY KEY(`id`)
);

ALTER TABLE `teach_materials`
  ADD COLUMN `slide_master_id` int NULL,
  ADD COLUMN `master_forced` boolean NOT NULL DEFAULT false;
