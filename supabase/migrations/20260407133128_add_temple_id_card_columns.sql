/*
  # Add Temple ID Card columns

  ## Summary
  Adds dedicated columns for Temple ID Card data, separate from the Aadhar fields
  which are reserved for future use.

  ## Changes
  ### Modified Tables
  - `sebayat_registrations`
    - Added `temple_id_card_number` (text, nullable) - stores the Temple ID Card number entered during registration
    - Added `temple_id_card_url` (text, nullable) - stores the uploaded Temple ID Card image URL

  ## Notes
  - `aadhar_number` and `id_proof_url` columns are kept intact for future Aadhar integration
  - Both new columns are nullable to maintain backwards compatibility with existing records
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'temple_id_card_number'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN temple_id_card_number text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'temple_id_card_url'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN temple_id_card_url text;
  END IF;
END $$;
