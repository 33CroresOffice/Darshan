/*
  # Add Aadhaar card URL to gumastas table

  1. Changes
    - `gumastas` table: add `aadhar_card_url` column (nullable text) to store the uploaded Aadhaar card image URL

  2. Notes
    - Nullable — existing records are unaffected
    - No RLS changes needed; existing policies cover the new column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gumastas' AND column_name = 'aadhar_card_url'
  ) THEN
    ALTER TABLE gumastas ADD COLUMN aadhar_card_url text;
  END IF;
END $$;
