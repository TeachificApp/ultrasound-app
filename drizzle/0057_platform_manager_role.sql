-- Add the limited Platform Manager app role without modifying existing user-role assignments.
ALTER TABLE `userRoles`
  MODIFY COLUMN `role` ENUM(
    'user',
    'premium_user',
    'diy_admin',
    'diy_user',
    'platform_admin',
    'platform_manager',
    'accreditation_manager',
    'education_manager',
    'education_admin',
    'education_student',
    'platform_owner',
    'platform_moderator',
    'instructor',
    'team_admin',
    'affiliate'
  ) NOT NULL;
