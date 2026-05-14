/*
  # Add Temple Health Card Fields to Sebayat Registrations

  1. New Columns
    - `temple_health_card_id` (text) - Up to 6 digit ID number for temple health card
    - `temple_health_card_url` (text, nullable) - URL for uploaded temple health card image

  2. Changes
    - Adding two new optional columns for temple health card information
    - These fields will be collected during registration
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'temple_health_card_id'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN temple_health_card_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'temple_health_card_url'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN temple_health_card_url text;
  END IF;
END $$;