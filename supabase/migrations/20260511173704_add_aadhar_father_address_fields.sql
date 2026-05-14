/*
  # Add Aadhar, Father's Name and Structured Address Fields

  ## Summary
  Adds new mandatory registration fields to the sebayat_registrations table.

  ## New Columns
  - `father_name` (text, nullable) - Father's full name — mandatory in the form
  - `aadhar_number` (text, nullable) - 12-digit Aadhar card number — mandatory in the form
  - `aadhar_card_url` (text, nullable) - Uploaded Aadhar card file (image or PDF) — mandatory in the form

  ## Address Columns
  The table already has `address`, `city`, `state`, `pincode` columns (nullable).
  We add dedicated columns for a two-address system:

  Permanent address (mandatory in form):
  - `permanent_address` (text, nullable) - Street / house number
  - `permanent_city` (text, nullable)
  - `permanent_state` (text, nullable)
  - `permanent_pincode` (text, nullable)

  Present address (optional, defaults to permanent if same):
  - `present_address` (text, nullable)
  - `present_city` (text, nullable)
  - `present_state` (text, nullable)
  - `present_pincode` (text, nullable)
  - `present_same_as_permanent` (boolean, default false) - Whether present address matches permanent

  ## Notes
  1. All columns are nullable at DB level — form validation enforces mandatory fields.
  2. Existing rows are unaffected (NULLs).
  3. No RLS changes — existing policies on sebayat_registrations cover these columns.
*/

-- Father's name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'father_name'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN father_name text;
  END IF;
END $$;

-- Aadhar number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'aadhar_number'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN aadhar_number text;
  END IF;
END $$;

-- Aadhar card file URL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'aadhar_card_url'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN aadhar_card_url text;
  END IF;
END $$;

-- Permanent address fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'permanent_address'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN permanent_address text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'permanent_city'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN permanent_city text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'permanent_state'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN permanent_state text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'permanent_pincode'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN permanent_pincode text;
  END IF;
END $$;

-- Present address fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'present_same_as_permanent'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN present_same_as_permanent boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'present_address'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN present_address text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'present_city'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN present_city text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'present_state'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN present_state text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'present_pincode'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN present_pincode text;
  END IF;
END $$;
