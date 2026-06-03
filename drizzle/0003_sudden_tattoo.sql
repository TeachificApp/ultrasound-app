-- Migration: Add accreditation form success modules tables
-- Mirrors generalFormSuccessModules / generalFormSuccessRoutingRules for DIY/accreditation forms

ALTER TABLE `accreditationFormTemplates`
  ADD COLUMN `defaultSuccessModuleId` int,
  ADD COLUMN `passingScorePercent` int;

CREATE TABLE `accreditationFormSuccessModules` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `templateId` int NOT NULL,
  `name` varchar(200) NOT NULL,
  `moduleType` enum('inline_message','full_page','redirect_url') NOT NULL,
  `inlineContent` longtext,
  `pageContent` longtext,
  `redirectUrl` varchar(2000),
  `isEnabled` boolean NOT NULL DEFAULT true,
  `sortOrder` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `accreditationFormSuccessRoutingRules` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `templateId` int NOT NULL,
  `ruleLabel` varchar(255) DEFAULT '',
  `successModuleId` int NOT NULL,
  `logicOperator` varchar(10) NOT NULL DEFAULT 'all',
  `conditions` longtext NOT NULL,
  `sortOrder` int NOT NULL DEFAULT 0,
  `isEnabled` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now())
);