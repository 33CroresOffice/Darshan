/*
  # Allow authenticated users to read daily_booking_cap_per_user setting

  The sebayat (regular) users need to read the daily_booking_cap_per_user
  system setting to display correct quota information. Previously only admins
  and supervisors could read system_settings, causing sebayat users to fall
  back to the hardcoded default of 30 instead of the admin-configured value.

  1. Changes
    - Add a new SELECT policy allowing any authenticated user to read the
      'daily_booking_cap_per_user' setting key.
*/

CREATE POLICY "Authenticated users can read daily booking cap setting"
  ON system_settings
  FOR SELECT
  TO authenticated
  USING (setting_key = 'daily_booking_cap_per_user');
