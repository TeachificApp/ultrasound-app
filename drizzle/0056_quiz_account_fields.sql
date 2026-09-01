ALTER TABLE standalone_quizzes ADD COLUMN IF NOT EXISTS account_fields LONGTEXT NULL;
ALTER TABLE standalone_quiz_attempts ADD COLUMN IF NOT EXISTS account_field_values LONGTEXT NULL;
ALTER TABLE lms_inline_quiz_attempts ADD COLUMN IF NOT EXISTS account_field_values LONGTEXT NULL;
