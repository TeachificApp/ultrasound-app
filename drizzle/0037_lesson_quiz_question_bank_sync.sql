ALTER TABLE question_bank
  ADD COLUMN source_lesson_id INT NULL,
  ADD COLUMN source_block_id VARCHAR(128) NULL,
  ADD COLUMN source_question_index INT NULL;

CREATE INDEX idx_question_bank_lesson_source
  ON question_bank (source_lesson_id, source_block_id, source_question_index);
