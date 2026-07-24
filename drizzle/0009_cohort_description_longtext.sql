-- Allow large rich-text descriptions (hosted image URLs + HTML) in cohort tables
ALTER TABLE `lms_cohort_sessions` MODIFY `description` LONGTEXT;
ALTER TABLE `lms_cohort_assignments` MODIFY `description` LONGTEXT;
ALTER TABLE `lms_cohort_recordings` MODIFY `description` LONGTEXT;
