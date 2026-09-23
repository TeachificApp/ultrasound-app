-- Expand the Social Post Library theme enum to match the established generator themes.
-- Existing dark/light records remain unchanged; this migration creates no post data.
ALTER TABLE `social_post_library`
  MODIFY COLUMN `cardTheme` ENUM('dark', 'light', 'white', 'teal', 'aqua') NOT NULL DEFAULT 'light';
