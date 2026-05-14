/*
  # Add Age, Allotment Number and Multi-Category Fields

  ## Summary
  Extends sebayat_registrations with three new fields required by the updated
  registration form:

  ## New Columns
  - `age` (integer, nullable) — Registrant's age in years; mandatory in the form
  - `allotment_number` (text, nullable) — Allotment number; mandatory in the form
  - `category_ids` (uuid[], nullable) — Array of selected category IDs allowing
    multi-select. Replaces the single `category_id` field for new registrations.
    The existing `category_id` column is kept for backward compatibility.

  ## Notes
  1. All columns are nullable at DB level; form validation enforces mandatory rules.
  2. Existing rows are unaffected.
  3. No RLS changes needed — existing policies cover the new columns.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'age'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN age integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'allotment_number'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN allotment_number text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'category_ids'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN category_ids uuid[];
  END IF;
END $$;
