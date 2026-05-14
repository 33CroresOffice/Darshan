/*
  # Add Ticket Validity System Setting

  1. Data Changes
    - Insert default ticket_validity_minutes setting (120 minutes = 2 hours)

  2. Notes
    - This setting controls how long a ticket is valid before expiration
    - Can be modified by superadmin and admin users
    - Default is 2 hours (120 minutes)
*/

-- Insert default ticket validity setting if it doesn't exist
INSERT INTO system_settings (setting_key, setting_value, created_at, updated_at)
VALUES ('ticket_validity_minutes', '120', now(), now())
ON CONFLICT (setting_key) DO NOTHING;