/*
  # Add darshan_slots_enabled System Setting

  ## Summary
  Inserts a new system setting that acts as a global master switch for the entire
  Darshan Slots feature. When set to false, all slot-related functionality is
  hidden from every user type (sebayat, supervisor, admin) — no slot selection
  on ticket creation, no slot sessions on the supervisor dashboard, and no slot
  availability display.

  ## Changes
  - `system_settings`: New row with key `darshan_slots_enabled`, default value `true`

  ## Notes
  1. Defaults to true so existing deployments are unaffected.
  2. Only superadmins can toggle this via the admin Settings screen.
  3. No RLS changes needed — existing read/write policies on system_settings apply.
*/

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('darshan_slots_enabled', '{"value": true}')
ON CONFLICT (setting_key) DO NOTHING;
