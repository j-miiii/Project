ALTER TABLE user_settings
  ADD COLUMN critical_sound_volume INT NOT NULL DEFAULT 100,
  ADD COLUMN caution_sound_volume INT NOT NULL DEFAULT 100,
  ADD COLUMN system_error_sound_volume INT NOT NULL DEFAULT 100;
