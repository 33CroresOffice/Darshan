/*
  # Add odia_name column to darshan_slots

  1. Changes
    - Add `odia_name` (text, nullable) column to `darshan_slots` table
    - Populate Odia translations for the four known temple darshan slots
  2. Notes
    - odia_name is nullable so existing/future slots without a translation still work
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'darshan_slots' AND column_name = 'odia_name'
  ) THEN
    ALTER TABLE darshan_slots ADD COLUMN odia_name text;
  END IF;
END $$;

UPDATE darshan_slots SET odia_name = 'ମଙ୍ଗଳ ଆରତି'    WHERE name = 'Mangala Arati';
UPDATE darshan_slots SET odia_name = 'ସକଳ ଧୂପ'       WHERE name = 'Sakala Dhoopa';
UPDATE darshan_slots SET odia_name = 'ମଧ୍ୟାହ୍ନ ଧୂପ'   WHERE name = 'Madhyana Dhoopa';
UPDATE darshan_slots SET odia_name = 'ସନ୍ଧ୍ୟା ଧୂପ'    WHERE name = 'Sandhya Dhoopa';
