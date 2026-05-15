/*
  # Add Gumasta (Proxy/Staff) System

  1. New Tables
    - `gumastas`
      - `id` (uuid, primary key)
      - `sebayat_id` (uuid, FK to sebayat_registrations) - the sebayat who owns this gumasta
      - `name` (text, required) - gumasta full name
      - `contact_number` (text, required) - gumasta phone number
      - `photo_url` (text, nullable) - gumasta photo in storage
      - `is_active` (boolean, default true) - can be disabled by sebayat
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modified Tables
    - `gate_entries`
      - Added `gumasta_id` (uuid, nullable FK to gumastas) - if set, ticket is assigned to this gumasta

  3. New System Settings
    - `gumasta_enabled` - global toggle for the feature (default false)
    - `gumasta_allowed_sebayat_ids` - JSON array of specific sebayat IDs allowed when global is off

  4. Security
    - Enable RLS on `gumastas` table
    - Sebayats can CRUD their own gumastas
    - Admins/supervisors can read gumastas (for gate display)
    - Authenticated users can read the gumasta settings
*/

-- Create gumastas table
CREATE TABLE IF NOT EXISTS gumastas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sebayat_id uuid NOT NULL REFERENCES sebayat_registrations(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_number text NOT NULL,
  photo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add gumasta_id to gate_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gate_entries' AND column_name = 'gumasta_id'
  ) THEN
    ALTER TABLE gate_entries ADD COLUMN gumasta_id uuid REFERENCES gumastas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE gumastas ENABLE ROW LEVEL SECURITY;

-- Policy: Sebayats can read their own gumastas
CREATE POLICY "Sebayats can read own gumastas"
  ON gumastas FOR SELECT
  TO authenticated
  USING (
    sebayat_id IN (
      SELECT id FROM sebayat_registrations WHERE user_id = auth.uid()
    )
  );

-- Policy: Admins and supervisors can read all gumastas (for gate display)
CREATE POLICY "Staff can read all gumastas"
  ON gumastas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin', 'supervisor')
    )
  );

-- Policy: Sebayats can insert their own gumastas
CREATE POLICY "Sebayats can create own gumastas"
  ON gumastas FOR INSERT
  TO authenticated
  WITH CHECK (
    sebayat_id IN (
      SELECT id FROM sebayat_registrations WHERE user_id = auth.uid()
    )
  );

-- Policy: Sebayats can update their own gumastas
CREATE POLICY "Sebayats can update own gumastas"
  ON gumastas FOR UPDATE
  TO authenticated
  USING (
    sebayat_id IN (
      SELECT id FROM sebayat_registrations WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    sebayat_id IN (
      SELECT id FROM sebayat_registrations WHERE user_id = auth.uid()
    )
  );

-- Policy: Sebayats can delete their own gumastas
CREATE POLICY "Sebayats can delete own gumastas"
  ON gumastas FOR DELETE
  TO authenticated
  USING (
    sebayat_id IN (
      SELECT id FROM sebayat_registrations WHERE user_id = auth.uid()
    )
  );

-- Add system settings for gumasta feature
INSERT INTO system_settings (setting_key, setting_value)
SELECT 'gumasta_enabled', '{"value": false}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings WHERE setting_key = 'gumasta_enabled'
);

INSERT INTO system_settings (setting_key, setting_value)
SELECT 'gumasta_allowed_sebayat_ids', '{"value": []}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings WHERE setting_key = 'gumasta_allowed_sebayat_ids'
);

-- Allow authenticated users to read gumasta settings
CREATE POLICY "Authenticated can read gumasta settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (
    setting_key IN ('gumasta_enabled', 'gumasta_allowed_sebayat_ids')
  );

-- Create index for fast lookup by sebayat_id
CREATE INDEX IF NOT EXISTS idx_gumastas_sebayat_id ON gumastas(sebayat_id);

-- Create index for gumasta_id on gate_entries
CREATE INDEX IF NOT EXISTS idx_gate_entries_gumasta_id ON gate_entries(gumasta_id);
