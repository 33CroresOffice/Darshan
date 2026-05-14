/*
  # Add OTP Channels System Setting

  ## Summary
  Adds a new system setting `otp_channels` that controls which OTP delivery
  channels are available on the login screen.

  ## New Setting
  - `otp_channels`: stored as setting_value JSON `{ "whatsapp": true, "sms": true }`
  - Default: both channels enabled
  - Only superadmins can modify this via the Settings screen

  ## Notes
  - Uses the existing `system_settings` table and its RLS policies
  - ON CONFLICT DO NOTHING ensures idempotency
*/

INSERT INTO system_settings (setting_key, setting_value)
VALUES (
  'otp_channels',
  '{"whatsapp": true, "sms": true}'::jsonb
)
ON CONFLICT (setting_key) DO NOTHING;
