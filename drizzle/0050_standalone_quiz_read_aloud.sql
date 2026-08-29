ALTER TABLE `standalone_quizzes`
  ADD COLUMN `read_aloud_enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN `read_aloud_voice` ENUM('female', 'male') NOT NULL DEFAULT 'female';
