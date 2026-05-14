/*
  # Allow public read of otp_channels setting

  The login screen is shown before authentication, so it needs to read the
  otp_channels setting without a session. This policy allows anyone (including
  unauthenticated visitors) to SELECT only the otp_channels row.
*/

CREATE POLICY "Anyone can read otp_channels setting"
  ON system_settings
  FOR SELECT
  TO anon
  USING (setting_key = 'otp_channels');
