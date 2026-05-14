/*
  # Fix Registration Approval Status Logic

  ## Problem
  The previous `resolve_registration_status` function marked a registration as "rejected"
  the moment ANY admin cast a rejection vote, even when other admins hadn't voted yet.
  This prevented other admins from seeing the approve button.

  ## New Behavior
  - Status stays "pending" while not all admins have cast a vote
  - Status becomes "approved" only when ALL active admins have voted "approved"
  - Status becomes "rejected" only when ALL active admins have voted AND at least one rejected
  - If an admin changes their vote (e.g., from rejected to approved), counts are recalculated

  ## Changes
  - Replaced `resolve_registration_status` function with corrected consensus logic
*/

CREATE OR REPLACE FUNCTION resolve_registration_status(p_registration_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_count integer;
  v_voted_count integer;
  v_approved_count integer;
  v_rejected_count integer;
  v_last_rejecter record;
BEGIN
  SELECT COUNT(*) INTO v_admin_count
  FROM profiles
  WHERE role = 'admin' AND is_active = true;

  SELECT
    COUNT(*) FILTER (WHERE action = 'approved'),
    COUNT(*) FILTER (WHERE action = 'rejected'),
    COUNT(*)
  INTO v_approved_count, v_rejected_count, v_voted_count
  FROM registration_approvals
  WHERE registration_id = p_registration_id;

  IF v_admin_count = 0 THEN
    RETURN;
  END IF;

  IF v_voted_count < v_admin_count THEN
    UPDATE sebayat_registrations
    SET
      approval_status = 'pending',
      rejection_reason = null,
      approved_by = null,
      approved_at = null,
      updated_at = now()
    WHERE id = p_registration_id
      AND approval_status != 'pending';
    RETURN;
  END IF;

  IF v_approved_count = v_admin_count THEN
    UPDATE sebayat_registrations
    SET
      approval_status = 'approved',
      rejection_reason = null,
      approved_by = (
        SELECT admin_id FROM registration_approvals
        WHERE registration_id = p_registration_id AND action = 'approved'
        ORDER BY updated_at DESC LIMIT 1
      ),
      approved_at = now(),
      updated_at = now()
    WHERE id = p_registration_id;
    RETURN;
  END IF;

  IF v_rejected_count > 0 THEN
    SELECT admin_id, rejection_reason INTO v_last_rejecter
    FROM registration_approvals
    WHERE registration_id = p_registration_id AND action = 'rejected'
    ORDER BY updated_at DESC
    LIMIT 1;

    UPDATE sebayat_registrations
    SET
      approval_status = 'rejected',
      rejection_reason = v_last_rejecter.rejection_reason,
      approved_by = v_last_rejecter.admin_id,
      approved_at = now(),
      updated_at = now()
    WHERE id = p_registration_id;
  END IF;
END;
$$;
