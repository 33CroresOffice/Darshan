/*
  # Add Darshan Slots System

  ## Summary
  Introduces a configurable slot-based booking system for Darshan management.
  Each day is divided into multiple time slots, each with its own capacity and per-user limits.

  ## New Tables
  - `darshan_slots`
    - `id` (uuid, primary key)
    - `name` (text) - Slot display name, e.g. "Morning Slot"
    - `start_time` (time) - Slot start time, e.g. "06:00"
    - `end_time` (time) - Slot end time, e.g. "09:00"
    - `duration_minutes` (integer) - Duration in minutes, separately entered by admin
    - `max_bookings` (integer) - Total capacity for this slot per day, e.g. 4000
    - `max_bookings_per_user` (integer) - Max bookings a single sebayat can make for this slot, e.g. 10
    - `is_active` (boolean) - Whether the slot is currently active
    - `created_by` (FK to profiles)
    - `created_at`, `updated_at` (timestamps)

  ## Modified Tables
  - `gate_entries`: Added nullable `slot_id` FK column referencing `darshan_slots`

  ## New System Settings
  - `daily_booking_cap_per_user` - Global daily cap: max total bookings a user can make across all slots per day (default 30)
  - `default_slot_max_bookings` - Default total capacity for a new slot (default 4000)
  - `default_slot_max_per_user` - Default per-user per-slot cap (default 10)

  ## Security
  - RLS enabled on `darshan_slots`
  - Superadmin-only: insert, update, delete
  - All authenticated users: select (active slots only for non-superadmin, all for superadmin)
*/

CREATE TABLE IF NOT EXISTS darshan_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 180,
  max_bookings integer NOT NULL DEFAULT 4000,
  max_bookings_per_user integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE darshan_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active darshan slots"
  ON darshan_slots FOR SELECT
  TO authenticated
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
  ));

CREATE POLICY "Superadmin can insert darshan slots"
  ON darshan_slots FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
  ));

CREATE POLICY "Superadmin can update darshan slots"
  ON darshan_slots FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
  ));

CREATE POLICY "Superadmin can delete darshan slots"
  ON darshan_slots FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
  ));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gate_entries' AND column_name = 'slot_id'
  ) THEN
    ALTER TABLE gate_entries ADD COLUMN slot_id uuid REFERENCES darshan_slots(id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_darshan_slots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER darshan_slots_updated_at
  BEFORE UPDATE ON darshan_slots
  FOR EACH ROW EXECUTE FUNCTION update_darshan_slots_updated_at();

INSERT INTO system_settings (setting_key, setting_value)
VALUES
  ('daily_booking_cap_per_user', '{"value": 30}'),
  ('default_slot_max_bookings', '{"value": 4000}'),
  ('default_slot_max_per_user', '{"value": 10}')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO darshan_slots (name, start_time, end_time, duration_minutes, max_bookings, max_bookings_per_user, is_active)
VALUES
  ('Morning Slot', '06:00', '09:00', 180, 4000, 10, true),
  ('Forenoon Slot', '09:00', '12:00', 180, 4000, 10, true),
  ('Afternoon Slot', '13:00', '16:00', 180, 4000, 10, true),
  ('Evening Slot', '17:00', '20:00', 180, 4000, 10, true)
ON CONFLICT DO NOTHING;
