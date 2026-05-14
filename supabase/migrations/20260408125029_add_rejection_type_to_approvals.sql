/*
  # Add rejection_type to registration_approvals

  ## Summary
  Adds a `rejection_type` column to `registration_approvals` to distinguish between
  two kinds of rejections:
  - `wrong_data`: The applicant submitted incorrect information and should be allowed to resubmit
  - `management_decision`: Rejected by management policy; the resubmit option should be hidden/disabled

  ## Changes
  - `registration_approvals`: New column `rejection_type` (text, nullable, constrained to valid values)
  - Also adds `rejection_type` to `sebayat_registrations` so the final resolved type is accessible
    without joining approvals every time.

  ## Notes
  - Existing rows will have NULL rejection_type (treated as wrong_data for backwards compatibility)
  - The constraint allows only 'wrong_data' or 'management_decision' values
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registration_approvals' AND column_name = 'rejection_type'
  ) THEN
    ALTER TABLE registration_approvals
      ADD COLUMN rejection_type text
      CHECK (rejection_type IN ('wrong_data', 'management_decision'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'rejection_type'
  ) THEN
    ALTER TABLE sebayat_registrations
      ADD COLUMN rejection_type text
      CHECK (rejection_type IN ('wrong_data', 'management_decision'));
  END IF;
END $$;
