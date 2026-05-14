/*
  # Clear Admin Votes on Resubmission

  ## Purpose
  When a sebayat resubmits their registration after rejection, all previous admin
  approval/rejection votes are deleted so every admin must review the updated
  application fresh. This prevents stale votes from affecting the new review cycle.

  ## Changes
  - New function: `clear_votes_on_resubmission` — deletes all registration_approvals
    rows for a registration when its approval_status changes TO 'pending' FROM 'rejected'
  - New trigger: `on_registration_resubmitted` — fires AFTER UPDATE on
    sebayat_registrations when status transitions from rejected -> pending
*/

CREATE OR REPLACE FUNCTION clear_votes_on_resubmission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.approval_status = 'rejected' AND NEW.approval_status = 'pending' THEN
    DELETE FROM registration_approvals
    WHERE registration_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_registration_resubmitted ON sebayat_registrations;

CREATE TRIGGER on_registration_resubmitted
  AFTER UPDATE ON sebayat_registrations
  FOR EACH ROW
  EXECUTE FUNCTION clear_votes_on_resubmission();
