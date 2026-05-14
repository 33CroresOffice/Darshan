/*
  # Allow public read of temple_id_card_enabled setting

  ## Summary
  Sebayat users (unauthenticated at registration time) could not read the
  `temple_id_card_enabled` system setting, causing the code to fall back to
  `true` and always show the Temple ID card fields even when disabled.

  ## Changes
  - `system_settings`: Add SELECT policy allowing anyone to read the
    `temple_id_card_enabled` row (mirrors the existing otp_channels policy).
*/

CREATE POLICY "Anyone can read temple_id_card_enabled setting"
  ON system_settings
  FOR SELECT
  USING (setting_key = 'temple_id_card_enabled');
