/*
  # Update Resubmission Trigger with Round Logic

  ## Overview
  Replaces the old `clear_votes_on_resubmission` trigger (which deleted all votes)
  with a new version that preserves all votes as historical records tagged by round.

  ## New Behavior on Resubmission (rejected -> pending transition)
  1. Saves a snapshot of the current key fields into the `old_data` JSONB column
  2. Increments `submission_round` by 1
  3. Does NOT delete any old votes — they remain tagged to their original round
  4. Auto-carries-forward all admins who approved in the previous round by inserting
     new approval votes for the new round with action = 'approved'
  5. Admins who rejected previously get no auto-vote — they must review and vote again

  ## Updated resolve_registration_status
  - Now filters all vote queries by the current `submission_round` so old round
    votes don't interfere with the current round's resolution

  ## Changes
  - Replaced `clear_votes_on_resubmission` function
  - Replaced `resolve_registration_status` function
  - Re-created `on_registration_resubmitted` trigger
*/

-- Updated resubmission handler: preserve history, increment round, carry forward approvals
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

    -- Carry forward approvals from previous round for admins who approved
    INSERT INTO registration_approvals (registration_id, admin_id, action, rejection_reason, submission_round)
    SELECT
      registration_id,
      admin_id,
      'approved',
      NULL,
      v_prev_round + 1
    FROM registration_approvals
    WHERE registration_id = NEW.id
      AND submission_round = v_prev_round
      AND action = 'approved'
    ON CONFLICT (registration_id, admin_id, submission_round) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_registration_resubmitted ON sebayat_registrations;

CREATE TRIGGER on_registration_resubmitted
  AFTER UPDATE ON sebayat_registrations
  FOR EACH ROW
  EXECUTE FUNCTION clear_votes_on_resubmission();

-- Update resolve_registration_status to filter by current submission_round
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
BEGIN
  SELECT submission_round INTO v_current_round
  FROM sebayat_registrations
  WHERE id = p_registration_id;

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
    SELECT admin_id, rejection_reason INTO v_last_rejecter
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
      approved_by = v_last_rejecter.admin_id,
      approved_at = now(),
      updated_at = now()
    WHERE id = p_registration_id;
  END IF;
END;
$$;
