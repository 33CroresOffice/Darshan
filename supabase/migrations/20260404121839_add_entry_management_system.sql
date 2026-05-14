/*
  # Entry Management System - Core Tables and Functions

  1. Schema Changes
    - Add 'supervisor' to user_role enum
    - Create system_settings table for configurable limits
    - Create gate_entries table for tracking devotee entries
    - Create entry_audit_logs table for comprehensive audit trail

  2. New Tables
    - `system_settings` - Key-value store for system configuration
      - `id` (uuid, primary key)
      - `setting_key` (text, unique) - e.g., 'max_devotees_per_day'
      - `setting_value` (jsonb) - flexible value storage
      - `updated_by` (uuid) - admin who last updated
      - `updated_at` (timestamptz)
    
    - `gate_entries` - Tracks each entry through the gates
      - `id` (uuid, primary key)
      - `entry_code` (text, unique) - 6-digit verification code
      - `qr_code_data` (jsonb) - encoded entry information
      - `sebayat_id` (uuid) - FK to sebayat_registrations
      - `west_gate_supervisor_id` (uuid) - FK to profiles
      - `inner_gate_supervisor_id` (uuid, nullable) - FK to profiles
      - `declared_devotee_count` (int) - count at west gate
      - `verified_devotee_count` (int, nullable) - final count at inner gate
      - `status` (entry_status enum) - registered/verified/discrepancy/cancelled
      - `entry_date` (date) - for daily tracking
      - `west_gate_entry_time` (timestamptz)
      - `inner_gate_verification_time` (timestamptz, nullable)
      - `notes` (text, nullable) - supervisor remarks
    
    - `entry_audit_logs` - Immutable audit trail
      - `id` (uuid, primary key)
      - `entry_id` (uuid) - FK to gate_entries
      - `action_type` (entry_action enum)
      - `performed_by` (uuid) - FK to profiles
      - `old_values` (jsonb)
      - `new_values` (jsonb)
      - `reason` (text, nullable)
      - `gate_location` (gate_location enum)
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on all new tables
    - Supervisors can create/update entries
    - Sebayats can view their own entries
    - Admins have full read access
*/

-- Add supervisor to user_role enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'supervisor' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'supervisor';
  END IF;
END $$;

-- Create entry_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entry_status') THEN
    CREATE TYPE entry_status AS ENUM ('registered', 'verified', 'discrepancy_flagged', 'cancelled');
  END IF;
END $$;

-- Create entry_action enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entry_action') THEN
    CREATE TYPE entry_action AS ENUM ('created', 'count_adjusted', 'verified', 'cancelled', 'flagged');
  END IF;
END $$;

-- Create gate_location enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gate_location') THEN
    CREATE TYPE gate_location AS ENUM ('west_gate', 'inner_gate');
  END IF;
END $$;

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default max_devotees_per_day setting
INSERT INTO system_settings (setting_key, setting_value)
VALUES ('max_devotees_per_day', '{"value": 50}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- Create gate_entries table
CREATE TABLE IF NOT EXISTS gate_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_code text UNIQUE NOT NULL,
  qr_code_data jsonb,
  sebayat_id uuid NOT NULL REFERENCES sebayat_registrations(id) ON DELETE RESTRICT,
  west_gate_supervisor_id uuid NOT NULL REFERENCES profiles(id),
  inner_gate_supervisor_id uuid REFERENCES profiles(id),
  declared_devotee_count integer NOT NULL CHECK (declared_devotee_count > 0),
  verified_devotee_count integer CHECK (verified_devotee_count >= 0),
  status entry_status NOT NULL DEFAULT 'registered',
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  west_gate_entry_time timestamptz NOT NULL DEFAULT now(),
  inner_gate_verification_time timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_gate_entries_entry_date ON gate_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_gate_entries_sebayat_date ON gate_entries(sebayat_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_gate_entries_status ON gate_entries(status);
CREATE INDEX IF NOT EXISTS idx_gate_entries_entry_code ON gate_entries(entry_code);

-- Create entry_audit_logs table
CREATE TABLE IF NOT EXISTS entry_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES gate_entries(id) ON DELETE CASCADE,
  action_type entry_action NOT NULL,
  performed_by uuid NOT NULL REFERENCES profiles(id),
  old_values jsonb,
  new_values jsonb,
  reason text,
  gate_location gate_location NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create index for efficient entry lookup
CREATE INDEX IF NOT EXISTS idx_entry_audit_logs_entry_id ON entry_audit_logs(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_audit_logs_created_at ON entry_audit_logs(created_at);

-- Function to generate unique 6-character entry code
CREATE OR REPLACE FUNCTION generate_entry_code()
RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get sebayat remaining quota for a date
CREATE OR REPLACE FUNCTION get_sebayat_remaining_quota(p_sebayat_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS integer AS $$
DECLARE
  max_limit integer;
  used_count integer;
BEGIN
  -- Get max limit from settings
  SELECT (setting_value->>'value')::integer INTO max_limit
  FROM system_settings
  WHERE setting_key = 'max_devotees_per_day';
  
  IF max_limit IS NULL THEN
    max_limit := 50; -- Default fallback
  END IF;
  
  -- Get used count for the sebayat on the given date
  SELECT COALESCE(SUM(
    CASE 
      WHEN verified_devotee_count IS NOT NULL THEN verified_devotee_count
      ELSE declared_devotee_count
    END
  ), 0) INTO used_count
  FROM gate_entries
  WHERE sebayat_id = p_sebayat_id
    AND entry_date = p_date
    AND status NOT IN ('cancelled');
  
  RETURN max_limit - used_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is supervisor
CREATE OR REPLACE FUNCTION is_supervisor(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND role = 'supervisor'
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_settings
CREATE POLICY "Admins and superadmins can read settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (is_admin_or_superadmin() OR is_supervisor(auth.uid()));

CREATE POLICY "Admins and superadmins can update settings"
  ON system_settings FOR UPDATE
  TO authenticated
  USING (is_admin_or_superadmin())
  WITH CHECK (is_admin_or_superadmin());

-- RLS Policies for gate_entries
CREATE POLICY "Supervisors can create entries"
  ON gate_entries FOR INSERT
  TO authenticated
  WITH CHECK (is_supervisor(auth.uid()));

CREATE POLICY "Supervisors can update entries"
  ON gate_entries FOR UPDATE
  TO authenticated
  USING (is_supervisor(auth.uid()))
  WITH CHECK (is_supervisor(auth.uid()));

CREATE POLICY "Supervisors and admins can view all entries"
  ON gate_entries FOR SELECT
  TO authenticated
  USING (
    is_admin_or_superadmin() 
    OR is_supervisor(auth.uid())
    OR sebayat_id IN (
      SELECT id FROM sebayat_registrations WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for entry_audit_logs
CREATE POLICY "Supervisors can create audit logs"
  ON entry_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (is_supervisor(auth.uid()) OR is_admin_or_superadmin());

CREATE POLICY "Admins and supervisors can view audit logs"
  ON entry_audit_logs FOR SELECT
  TO authenticated
  USING (is_admin_or_superadmin() OR is_supervisor(auth.uid()));

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_gate_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gate_entries_updated_at ON gate_entries;
CREATE TRIGGER gate_entries_updated_at
  BEFORE UPDATE ON gate_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_gate_entries_updated_at();

-- Trigger to auto-update system_settings updated_at
DROP TRIGGER IF EXISTS system_settings_updated_at ON system_settings;
CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_gate_entries_updated_at();
