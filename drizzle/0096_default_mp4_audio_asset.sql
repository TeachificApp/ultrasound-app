-- Store the selected Media Repository audio asset used by default for all administrator MP4 card exports.
-- Nullable so the default can be cleared without affecting any saved media.
ALTER TABLE `platform_settings`
  ADD COLUMN `default_mp4_audio_asset_id` INT NULL AFTER `default_brand`;
