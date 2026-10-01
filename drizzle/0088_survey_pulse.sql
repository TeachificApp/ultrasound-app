-- Additive anonymous Sonographer Survey Pulse responses.
-- Privacy guarantee: this table intentionally contains no user, contact, IP,
-- device, employer, workplace, or free-text fields.
CREATE TABLE IF NOT EXISTS `survey_pulse_responses` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `state` VARCHAR(2) NOT NULL,
  `specialty` VARCHAR(100) NOT NULL,
  `credentials_json` TEXT NULL,
  `experience_band` VARCHAR(40) NOT NULL,
  `employment_setting` VARCHAR(100) NOT NULL,
  `employment_type` VARCHAR(50) NOT NULL,
  `role` VARCHAR(100) NOT NULL,
  `annual_base_salary_cents` INT NOT NULL,
  `hourly_rate_cents` INT NULL,
  `weekly_hours` SMALLINT NULL,
  `call_responsibilities` BOOLEAN NOT NULL DEFAULT FALSE,
  `call_pay_type` VARCHAR(80) NULL,
  `additional_compensation_cents` INT NULL,
  `travel_assignment` BOOLEAN NOT NULL DEFAULT FALSE,
  `benefits_json` TEXT NULL,
  `submitted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_survey_pulse_state` (`state`),
  INDEX `idx_survey_pulse_specialty` (`specialty`),
  INDEX `idx_survey_pulse_submitted` (`submitted_at`)
);
