/*
  # Add Multi-Admin Registration Approvals System

  ## Overview
  Replaces the single-admin approve/reject flow with a multi-admin voting system.
  Each admin (role = 'admin' only, not superadmin) must vote. A single rejection
  immediately rejects the registration. Only when ALL admins approve does the
  registration become approved.

  ## New Tables
  - `registration_approvals`
    - `id` (uuid, primary key)
    - `registration_id` (uuid, FK to sebayat_registrations) - which registration
    - `admin_id` (uuid, FK to profiles) - which admin voted
    - `action` (text, 'approved' or 'rejected') - the vote
    - `rejection_reason` (text, nullable) - reason if rejected
    - `created_at` (timestamptz) - when vote was cast
    - `updated_at` (timestamptz) - when vote was last changed (for revotes)
    - Unique constraint on (registration_id, admin_id) - one vote per admin per registration

  ## New Functions
  - `resolve_registration_status(p_registration_id uuid)` - Computes and writes
    the final approval_status based on current votes. Called by trigger.
  - `on_registration_approval_change()` - Trigger function that calls resolver.

  ## Security
  - RLS enabled on registration_approvals
  - Admins and superadmins can insert/update their own votes
  - All admins and superadmins can read all votes
*/

CREATE TABLE IF NOT EXISTS registration_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES sebayat_registrations(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (registration_id, admin_id)
);

ALTER TABLE registration_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert own votes"
  ON registration_approvals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can update own votes"
  ON registration_approvals
  FOR UPDATE
  TO authenticated
  USING (admin_id = auth.uid())
  WITH CHECK (
    admin_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can read all votes"
  ON registration_approvals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

CREATE OR REPLACE FUNCTION resolve_registration_status(p_registration_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_count integer;
  v_approved_count integer;
  v_rejection record;
BEGIN
  SELECT COUNT(*) INTO v_admin_count
  FROM profiles
  WHERE role = 'admin' AND is_active = true;

  SELECT COUNT(*) INTO v_approved_count
  FROM registration_approvals
  WHERE registration_id = p_registration_id AND action = 'approved';

  SELECT admin_id, rejection_reason INTO v_rejection
  FROM registration_approvals
  WHERE registration_id = p_registration_id AND action = 'rejected'
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_rejection.admin_id IS NOT NULL THEN
    UPDATE sebayat_registrations
    SET
      approval_status = 'rejected',
      rejection_reason = v_rejection.rejection_reason,
      approved_by = v_rejection.admin_id,
      approved_at = now(),
      updated_at = now()
    WHERE id = p_registration_id;
  ELSIF v_admin_count > 0 AND v_approved_count >= v_admin_count THEN
    UPDATE sebayat_registrations
    SET
      approval_status = 'approved',
      approved_by = (
        SELECT admin_id FROM registration_approvals
        WHERE registration_id = p_registration_id AND action = 'approved'
        ORDER BY updated_at DESC LIMIT 1
      ),
      approved_at = now(),
      updated_at = now()
    WHERE id = p_registration_id;
  ELSE
    UPDATE sebayat_registrations
    SET
      approval_status = 'pending',
      rejection_reason = null,
      approved_by = null,
      approved_at = null,
      updated_at = now()
    WHERE id = p_registration_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION on_registration_approval_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM resolve_registration_status(NEW.registration_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_registration_approval_change
AFTER INSERT OR UPDATE ON registration_approvals
FOR EACH ROW
EXECUTE FUNCTION on_registration_approval_change();
