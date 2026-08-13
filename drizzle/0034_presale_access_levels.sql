ALTER TABLE `webinar_registrations`
  ADD COLUMN `access_level` ENUM('full','presale') NOT NULL DEFAULT 'full';

ALTER TABLE `workshop_enrollments`
  ADD COLUMN `access_level` ENUM('full','presale') NOT NULL DEFAULT 'full';
