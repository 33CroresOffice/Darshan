/*
  # Fix resubmission trigger security context

  ## Problem
  The `clear_votes_on_resubmission` trigger function performs:
  1. An UPDATE on `sebayat_registrations` (to save old_data and increment submission_round)
  2. An INSERT into `registration_approvals` (to carry forward approvals from the previous round)

  Both of these run in the user's security context. When a regular sebayat user resubmits,
  the INSERT into `registration_approvals` fails because RLS only allows admins to insert
  rows into that table (policy checks that admin_id = auth.uid() AND role = admin/superadmin).

  ## Fix
  Recreate the trigger function with SECURITY DEFINER so it runs with elevated privileges,
  bypassing RLS for the internal bookkeeping operations.
*/

CREATE OR REPLACE FUNCTION clear_votes_on_resubmission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
