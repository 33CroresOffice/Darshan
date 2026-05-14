/*
  # Add Submission Round Tracking

  ## Overview
  This migration adds round-based tracking to the registration approval system,
  enabling admins to review resubmitted applications with full history preserved.

  ## Changes

  ### Modified Tables: sebayat_registrations
  - `submission_round` (integer, default 1): Tracks which review cycle the registration is on.
    Increments by 1 each time a rejected registration is resubmitted.
  - `old_data` (jsonb, nullable): Snapshot of all key fields before the most recent
    resubmission. Used to show diffs in the admin review screen.

  ### Modified Tables: registration_approvals
  - `submission_round` (integer, default 1): Tags every vote to its round so old
    votes are never lost and can be displayed in history.

  ### Constraint Changes
  - Drop old unique constraint `(registration_id, admin_id)` on registration_approvals
  - Add new unique constraint `(registration_id, admin_id, submission_round)` so
    the same admin can vote once per round.

  ## Security
  - RLS policies are not changed. Existing policies remain in effect.

  ## Notes
  1. All existing rows default to submission_round = 1 via DEFAULT clause.
  2. The old_data column will be null for existing registrations until first resubmission.
*/

-- Add submission_round to sebayat_registrations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'submission_round'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN submission_round integer NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Add old_data snapshot column to sebayat_registrations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'old_data'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN old_data jsonb DEFAULT NULL;
  END IF;
END $$;

-- Add submission_round to registration_approvals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registration_approvals' AND column_name = 'submission_round'
  ) THEN
    ALTER TABLE registration_approvals ADD COLUMN submission_round integer NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Drop old unique constraint and add new round-aware one
DO $$
BEGIN
  -- Drop old unique constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'registration_approvals'
    AND constraint_name = 'registration_approvals_registration_id_admin_id_key'
  ) THEN
    ALTER TABLE registration_approvals DROP CONSTRAINT registration_approvals_registration_id_admin_id_key;
  END IF;

  -- Add new unique constraint per round
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'registration_approvals'
    AND constraint_name = 'registration_approvals_registration_id_admin_id_round_key'
  ) THEN
    ALTER TABLE registration_approvals ADD CONSTRAINT registration_approvals_registration_id_admin_id_round_key
      UNIQUE (registration_id, admin_id, submission_round);
  END IF;
END $$;
