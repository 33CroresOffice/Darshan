/*
  # Fix Resubmission Trigger Loop and Add rejection_type to resolve function

  ## Problem
  When a user resubmits:
  1. `resubmitRegistration` updates sebayat_registrations → pending
  2. `on_registration_resubmitted` trigger fires → nested UPDATE (increment round) + INSERT into registration_approvals (carry-forward approvals)
  3. That INSERT fires `trg_registration_approval_change` → calls `resolve_registration_status`
  4. `resolve_registration_status` does another UPDATE on sebayat_registrations
  5. This fires `on_registration_resubmitted` AGAIN causing a loop/error

  ## Fix
  - Add a guard in `resolve_registration_status`: if the registration is currently 'pending'
    AND the trigger context is a carry-forward insert (action = 'approved'), skip resolving
    to avoid the loop. Done by checking if ALL votes in the new round are approved carry-forwards
    (i.e., total voted < total admins, so status should stay pending anyway).
  - The existing logic already handles this: if voted < admin_count it returns early.
    But the issue is the nested UPDATE inside clear_votes_on_resubmission fires another
    trigger cycle. Fix by disabling the approval trigger during the carry-forward INSERT
    using a session variable guard.

  ## Also fixes
  - `resolve_registration_status` now also copies `rejection_type` from the latest rejection vote
    so the field stays consistent when status resolves to rejected.
*/

-- Updated resolve_registration_status: also sets rejection_type, and guards against resubmission loop
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
  v_current_round integer;
  v_current_status text;
BEGIN
  SELECT submission_round, approval_status
  INTO v_current_round, v_current_status
  FROM sebayat_registrations
  WHERE id = p_registration_id;

  -- Guard: if we are inside a resubmission carry-forward (session flag set), skip
  IF current_setting('app.resubmission_in_progress', true) = 'true' THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_admin_count
  FROM profiles
  WHERE role = 'admin' AND is_active = true;

  SELECT
    COUNT(*) FILTER (WHERE action = 'approved'),
    COUNT(*) FILTER (WHERE action = 'rejected'),
    COUNT(*)
  INTO v_approved_count, v_rejected_count, v_voted_count
  FROM registration_approvals
  WHERE registration_id = p_registration_id
    AND submission_round = v_current_round;

  IF v_admin_count = 0 THEN
    RETURN;
  END IF;

  IF v_voted_count < v_admin_count THEN
    UPDATE sebayat_registrations
    SET
      approval_status = 'pending',
      rejection_reason = null,
      rejection_type = null,
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
      rejection_type = null,
      approved_by = (
        SELECT admin_id FROM registration_approvals
        WHERE registration_id = p_registration_id
          AND submission_round = v_current_round
          AND action = 'approved'
        ORDER BY updated_at DESC LIMIT 1
      ),
      approved_at = now(),
      updated_at = now()
    WHERE id = p_registration_id;
    RETURN;
  END IF;

  IF v_rejected_count > 0 THEN
    SELECT admin_id, rejection_reason, rejection_type INTO v_last_rejecter
    FROM registration_approvals
    WHERE registration_id = p_registration_id
      AND submission_round = v_current_round
      AND action = 'rejected'
    ORDER BY updated_at DESC
    LIMIT 1;

    UPDATE sebayat_registrations
    SET
      approval_status = 'rejected',
      rejection_reason = v_last_rejecter.rejection_reason,
      rejection_type = v_last_rejecter.rejection_type,
      approved_by = v_last_rejecter.admin_id,
      approved_at = now(),
      updated_at = now()
    WHERE id = p_registration_id;
  END IF;
END;
$$;

-- Updated resubmission trigger: sets session flag before carry-forward INSERT to prevent loop
CREATE OR REPLACE FUNCTION clear_votes_on_resubmission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prev_round integer;
BEGIN
  IF OLD.approval_status = 'rejected' AND NEW.approval_status = 'pending' THEN
    v_prev_round := OLD.submission_round;

    -- Save snapshot of old data before this resubmission
    UPDATE sebayat_registrations
    SET
      old_data = jsonb_build_object(
        'full_name', OLD.full_name,
        'temple_health_card_id', OLD.temple_health_card_id,
        'temple_health_card_url', OLD.temple_health_card_url,
        'temple_id_card_number', OLD.temple_id_card_number,
        'temple_id_card_url', OLD.temple_id_card_url,
        'photo_url', OLD.photo_url,
        'category_id', OLD.category_id,
        'submission_round', OLD.submission_round
      ),
      submission_round = v_prev_round + 1
    WHERE id = NEW.id;

    -- Set session flag so resolve_registration_status skips during carry-forward inserts
    PERFORM set_config('app.resubmission_in_progress', 'true', true);

    -- Carry forward approvals from previous round
    INSERT INTO registration_approvals (registration_id, admin_id, action, rejection_reason, rejection_type, submission_round)
    SELECT
      registration_id,
      admin_id,
      'approved',
      NULL,
      NULL,
      v_prev_round + 1
    FROM registration_approvals
    WHERE registration_id = NEW.id
      AND submission_round = v_prev_round
      AND action = 'approved'
    ON CONFLICT (registration_id, admin_id, submission_round) DO NOTHING;

    -- Clear the flag
    PERFORM set_config('app.resubmission_in_progress', 'false', true);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_registration_resubmitted ON sebayat_registrations;

CREATE TRIGGER on_registration_resubmitted
  AFTER UPDATE ON sebayat_registrations
  FOR EACH ROW
  EXECUTE FUNCTION clear_votes_on_resubmission();
