/*
  # Add Print Token System Settings

  ## Summary
  Adds two new system settings to control the print token feature:

  1. `print_token_enabled` (boolean, default false)
     - Master on/off switch for the entire print token feature
     - When false, no print buttons are shown anywhere in the app
     - Controlled by admins and superadmins

  2. `print_token_include_photo` (boolean, default false)
     - When true, the sebayat's registered photo is embedded in the printed token
     - Only relevant when print_token_enabled is true
     - Controlled by admins and superadmins

  ## Notes
  - Follows the same { value: boolean } JSONB pattern as temple_id_card_enabled and darshan_slots_enabled
  - Uses INSERT ... ON CONFLICT DO NOTHING to be idempotent
  - No RLS changes needed — existing system_settings policies already apply
*/

INSERT INTO system_settings (setting_key, setting_value)
VALUES
  ('print_token_enabled', '{"value": false}'::jsonb),
  ('print_token_include_photo', '{"value": false}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
