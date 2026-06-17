-- TEACH platform: instructor presentations & media workspace
-- Shared by LMS Instructors and EducatorAssist educators

CREATE TABLE IF NOT EXISTS `teach_materials` (
  `id` int AUTO_INCREMENT NOT NULL,
  `owner_user_id` int NOT NULL,
  `owner_context` enum('lms_instructor','educator_assist') NOT NULL DEFAULT 'lms_instructor',
  `lms_instructor_id` int,
  `educator_org_id` int,
  `material_type` enum('presentation','media','document') NOT NULL DEFAULT 'media',
  `title` varchar(300) NOT NULL,
  `description` text,
  `media_asset_id` int,
  `slides_data` longtext,
  `status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `teach_materials_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `teach_material_permissions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `material_id` int NOT NULL,
  `grantee_user_id` int NOT NULL,
  `can_view` boolean NOT NULL DEFAULT true,
  `can_present` boolean NOT NULL DEFAULT false,
  `can_edit` boolean NOT NULL DEFAULT false,
  `can_manage` boolean NOT NULL DEFAULT false,
  `can_copy` boolean NOT NULL DEFAULT false,
  `can_download` boolean NOT NULL DEFAULT false,
  `granted_by_user_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `teach_material_permissions_id` PRIMARY KEY(`id`),
  UNIQUE KEY `teach_material_permissions_material_grantee` (`material_id`, `grantee_user_id`)
);
