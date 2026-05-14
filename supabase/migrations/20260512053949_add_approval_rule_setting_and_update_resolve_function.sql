/*
  # Add Approval Rule Setting and Update Registration Status Resolution

  ## Summary
  Adds a configurable approval rule that the super admin can set to control
  how sebayat registrations are approved. The rule is stored in system_settings
  and the DB trigger function reads it dynamically on every vote.

  ## New Setting
  - `system_settings`: New row with key `approval_rule`, default `{"value": "all_admins"}`

  ## Approval Rule Options
  - `all_admins`: Every active admin must approve (current behavior)
  - `majority`: More than half of admins approving immediately approves; majority rejecting immediately rejects
  - `any_admin`: First admin approval immediately approves the registration
  - `superadmin_only`: Admin votes are recorded for audit only; only a direct superadmin action changes status

  ## Changes
  - `system_settings`: Insert `approval_rule` row with default `all_admins`
  - `resolve_registration_status()`: Rewritten to branch on the active rule
  - Pending registrations: Votes cleared and status reset so new rule applies cleanly

  ## Security
  - Public SELECT policy added for `approval_rule` so authenticated admins can read it
  - No change to UPDATE/INSERT policies (superadmin only)

  ## Notes
  1. Existing approved/rejected registrations are NOT touched
  2. Only pending registrations have their votes cleared and status reset
  3. The superadmin_only rule relies on the existing overrideApproveRejected() path
*/

-- 1. Insert the default approval rule setting
INSERT INTO system_settings (setting_key, setting_value)
VALUES ('approval_rule', '{"value": "all_admins"}')
ON CONFLICT (setting_key) DO NOTHING;

-- 2. Public read policy for approval_rule (admins/sebayat need to read this)
CREATE POLICY "Anyone can read approval_rule setting"
  ON system_settings
  FOR SELECT
  USING (setting_key = 'approval_rule');

-- 3. Reset pending registrations: clear votes for current round and reset status
DO $$
DECLARE
  v_reg RECORD;
  v_round integer;
BEGIN
  FOR v_reg IN
    SELECT id, submission_round FROM sebayat_registrations
    WHERE approval_status = 'pending'
  LOOP
    v_round := v_reg.submission_round;
    -- Remove votes for the current (active) round only
    DELETE FROM registration_approvals
    WHERE registration_id = v_reg.id
      AND submission_round = v_round;
    -- Ensure status is cleanly pending with no stale data
    UPDATE sebayat_registrations
    SET
      rejection_reason = null,
      approved_by = null,
      approved_at = null,
      updated_at = now()
    WHERE id = v_reg.id;
  END LOOP;
END $$;

-- 4. Rewrite resolve_registration_status to honour the active approval rule
CREATE OR REPLACE FUNCTION resolve_registration_status(p_registration_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_count   integer;
  v_voted_count   integer;
  v_approved_count integer;
  v_rejected_count integer;
  v_majority      integer;
  v_rule          text;
  v_last_rejecter record;
BEGIN
  -- Read the active approval rule from system_settings
  SELECT COALESCE(setting_value->>'value', 'all_admins')
  INTO v_rule
  FROM system_settings
  WHERE setting_key = 'approval_rule';

  IF v_rule IS NULL THEN
    v_rule := 'all_admins';
  END IF;

  -- superadmin_only: admin votes have no effect on status
  IF v_rule = 'superadmin_only' THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_admin_count
  FROM profiles
  WHERE role = 'admin' AND is_active = true;

  IF v_admin_count = 0 THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE action = 'approved'),
    COUNT(*) FILTER (WHERE action = 'rejected'),
    COUNT(*)
  INTO v_approved_count, v_rejected_count, v_voted_count
  FROM registration_approvals
  WHERE registration_id = p_registration_id;

  -- ── ALL ADMINS ──────────────────────────────────────────────────────────────
  IF v_rule = 'all_admins' THEN
    IF v_voted_count < v_admin_count THEN
      UPDATE sebayat_registrations
      SET approval_status = 'pending',
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
      SET approval_status = 'approved',
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
      ORDER BY updated_at DESC LIMIT 1;

      UPDATE sebayat_registrations
      SET approval_status = 'rejected',
          rejection_reason = v_last_rejecter.rejection_reason,
          approved_by = v_last_rejecter.admin_id,
          approved_at = now(),
          updated_at = now()
      WHERE id = p_registration_id;
    END IF;
    RETURN;
  END IF;

  -- ── MAJORITY ────────────────────────────────────────────────────────────────
  IF v_rule = 'majority' THEN
    v_majority := (v_admin_count / 2) + 1;

    IF v_approved_count >= v_majority THEN
      UPDATE sebayat_registrations
      SET approval_status = 'approved',
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

    IF v_rejected_count >= v_majority THEN
      SELECT admin_id, rejection_reason INTO v_last_rejecter
      FROM registration_approvals
      WHERE registration_id = p_registration_id AND action = 'rejected'
      ORDER BY updated_at DESC LIMIT 1;

      UPDATE sebayat_registrations
      SET approval_status = 'rejected',
          rejection_reason = v_last_rejecter.rejection_reason,
          approved_by = v_last_rejecter.admin_id,
          approved_at = now(),
          updated_at = now()
      WHERE id = p_registration_id;
      RETURN;
    END IF;

    -- Neither threshold met yet — keep pending
    UPDATE sebayat_registrations
    SET approval_status = 'pending',
        rejection_reason = null,
        approved_by = null,
        approved_at = null,
        updated_at = now()
    WHERE id = p_registration_id
      AND approval_status != 'pending';
    RETURN;
  END IF;

  -- ── ANY ADMIN ───────────────────────────────────────────────────────────────
  IF v_rule = 'any_admin' THEN
    IF v_approved_count >= 1 THEN
      UPDATE sebayat_registrations
      SET approval_status = 'approved',
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

    IF v_rejected_count >= 1 THEN
      SELECT admin_id, rejection_reason INTO v_last_rejecter
      FROM registration_approvals
      WHERE registration_id = p_registration_id AND action = 'rejected'
      ORDER BY updated_at DESC LIMIT 1;

      UPDATE sebayat_registrations
      SET approval_status = 'rejected',
          rejection_reason = v_last_rejecter.rejection_reason,
          approved_by = v_last_rejecter.admin_id,
          approved_at = now(),
          updated_at = now()
      WHERE id = p_registration_id;
      RETURN;
    END IF;

    -- No votes yet
    UPDATE sebayat_registrations
    SET approval_status = 'pending',
        rejection_reason = null,
        approved_by = null,
        approved_at = null,
        updated_at = now()
    WHERE id = p_registration_id
      AND approval_status != 'pending';
    RETURN;
  END IF;

END;
$$;
