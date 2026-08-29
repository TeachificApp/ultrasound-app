-- Add customer_support to userRoles.role enum (run once on production MySQL)
ALTER TABLE `userRoles`
  MODIFY COLUMN `role` ENUM(
    'user',
    'premium_user',
    'diy_admin',
    'diy_user',
    'platform_admin',
    'accreditation_manager',
    'education_manager',
    'education_admin',
    'education_student',
    'platform_owner',
    'platform_moderator',
    'customer_support',
    'instructor',
    'team_admin',
    'affiliate'
  ) NOT NULL;
