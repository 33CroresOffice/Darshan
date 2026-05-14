/*
  # Add temple_id_card_enabled System Setting

  ## Summary
  Adds a superadmin-controlled toggle to show or hide the Temple ID Card fields
  (number input + file upload) in the sebayat registration and resubmission forms.
  When disabled, these fields are hidden and not validated or submitted.

  ## Changes
  - `system_settings`: New row with key `temple_id_card_enabled`, default value `true`

  ## Notes
  1. Defaults to true so existing deployments are unaffected.
  2. Only superadmins can toggle this setting.
  3. Uses public read policy already on system_settings so the registration
     form (unauthenticated-friendly) can read it.
*/

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('temple_id_card_enabled', '{"value": true}')
ON CONFLICT (setting_key) DO NOTHING;
