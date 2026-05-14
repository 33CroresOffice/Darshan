/*
  # Add offline_mode_enabled system setting

  1. New Setting
    - `offline_mode_enabled` (boolean, default true)
      Controls whether the app allows devices to queue operations locally when
      there is no internet connection. When false, all operations require a live
      connection; any attempt while offline will fail immediately.

  2. Notes
    - Defaults to true so the system is fully backwards-compatible.
    - Only super admins can change this value (enforced at the UI layer).
    - No schema changes — this is a pure data migration inserting one row into
      the existing system_settings table.
*/

INSERT INTO system_settings (setting_key, setting_value, updated_by)
VALUES ('offline_mode_enabled', '{"value": true}', NULL)
ON CONFLICT (setting_key) DO NOTHING;
