CREATE TABLE `cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` text NOT NULL,
	`category` enum('abdominal','pelvic_gyn','obstetric_1st','obstetric_2nd_3rd','thyroid','scrotum','breast','venous','arterial','abdominal_vascular','extracranial_carotid','intracranial_tcd','msk','pocus','physics','fetal_echo') NOT NULL,
	`caseType` enum('image','video','scenario') NOT NULL DEFAULT 'scenario',
	`clinicalHistory` text,
	`findings` text,
	`diagnosis` text,
	`teaching` text,
	`imageUrl` text,
	`videoUrl` text,
	`submittedBy` int,
	`submitterName` text,
	`submitterCredentials` text,
	`isPublished` boolean NOT NULL DEFAULT false,
	`viewCount` int NOT NULL DEFAULT 0,
	`displayViewCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `challengeResponses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`challengeId` int NOT NULL,
	`selectedAnswer` enum('A','B','C','D') NOT NULL,
	`isCorrect` boolean NOT NULL,
	`pointsEarned` int NOT NULL DEFAULT 0,
	`respondedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `challengeResponses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dailyChallenges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`challengeDate` varchar(10) NOT NULL,
	`question` text NOT NULL,
	`optionA` text NOT NULL,
	`optionB` text NOT NULL,
	`optionC` text NOT NULL,
	`optionD` text NOT NULL,
	`correctAnswer` enum('A','B','C','D') NOT NULL,
	`explanation` text NOT NULL,
	`category` varchar(64),
	`imageUrl` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dailyChallenges_id` PRIMARY KEY(`id`),
	CONSTRAINT `dailyChallenges_challengeDate_unique` UNIQUE(`challengeDate`)
);
--> statement-breakpoint
CREATE TABLE `flashcards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`category` enum('abdominal','pelvic_gyn','obstetric_1st','obstetric_2nd_3rd','thyroid','scrotum','breast','venous','arterial','abdominal_vascular','extracranial_carotid','intracranial_tcd','msk','pocus','physics','fetal_echo') NOT NULL,
	`difficulty` enum('basic','intermediate','advanced') NOT NULL DEFAULT 'basic',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `flashcards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `soundbytes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` enum('abdominal','pelvic_gyn','obstetric_1st','obstetric_2nd_3rd','thyroid','scrotum','breast','venous','arterial','abdominal_vascular','extracranial_carotid','intracranial_tcd','msk','pocus','physics','fetal_echo') NOT NULL,
	`videoUrl` text,
	`thumbnailUrl` text,
	`durationSeconds` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `soundbytes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `thinkificWebhookEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventType` varchar(128) NOT NULL,
	`thinkificUserId` varchar(128),
	`userEmail` varchar(320),
	`payload` json,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `thinkificWebhookEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `membershipTier` enum('free','premium') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `thinkificUserId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `streakCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totalPoints` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lastChallengeDate` varchar(10);--> statement-breakpoint
ALTER TABLE `users` ADD `flashcardsToday` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `flashcardsDate` varchar(10);