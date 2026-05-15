/*
  # Gumasta Approval System

  ## Summary
  Adds a full approval workflow for Gumastas, mirroring the sebayat registration
  approval system. Each new Gumasta starts as "pending" and must be approved by
  admins before it becomes active for ticket assignment.

  ## New Tables
  - `gumasta_approvals`
    - `id` (uuid, primary key)
    - `gumasta_id` (uuid, FK to gumastas)
    - `admin_id` (uuid, FK to profiles)
    - `action` ("approved" | "rejected")
    - `rejection_reason` (nullable text)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
    - Unique constraint: (gumasta_id, admin_id) — one vote per admin per gumasta

  ## Modified Tables
  - `gumastas`
    - `approval_status` (text, default "pending") — "pending" | "approved" | "rejected"
    - `rejection_reason` (nullable text)
    - `approved_at` (nullable timestamptz)
    - `rejected_at` (nullable timestamptz)

  ## New System Settings
  - `gumasta_approval_required` — boolean toggle; when false, new gumastas are auto-approved
  - `gumasta_approval_rule` — same rule options as sebayat approval_rule

  ## New Functions & Triggers
  - `resolve_gumasta_status(p_gumasta_id uuid)` — resolves approval status based on votes + rule
  - `trigger_resolve_gumasta_status` — fires after INSERT/UPDATE on gumasta_approvals

  ## Security
  - RLS on gumasta_approvals: admins can insert/update own vote; admins/superadmins can read all; sebayats can read their gumastas' votes
  - Public read policy added for the two new system settings
*/

-- 1. Add approval columns to gumastas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gumastas' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE gumastas ADD COLUMN approval_status text NOT NULL DEFAULT 'pending';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gumastas' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE gumastas ADD COLUMN rejection_reason text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gumastas' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE gumastas ADD COLUMN approved_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gumastas' AND column_name = 'rejected_at'
  ) THEN
    ALTER TABLE gumastas ADD COLUMN rejected_at timestamptz;
  END IF;
END $$;

-- 2. Create gumasta_approvals table
CREATE TABLE IF NOT EXISTS gumasta_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gumasta_id uuid NOT NULL REFERENCES gumastas(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gumasta_id, admin_id)
);

CREATE INDEX IF NOT EXISTS idx_gumasta_approvals_gumasta_id ON gumasta_approvals(gumasta_id);
CREATE INDEX IF NOT EXISTS idx_gumasta_approvals_admin_id ON gumasta_approvals(admin_id);

-- 3. Enable RLS on gumasta_approvals
ALTER TABLE gumasta_approvals ENABLE ROW LEVEL SECURITY;

-- Admins and superadmins can read all votes
CREATE POLICY "Admins can read all gumasta approvals"
  ON gumasta_approvals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Sebayats can read votes on their own gumastas
CREATE POLICY "Sebayats can read votes on own gumastas"
  ON gumasta_approvals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gumastas g
      JOIN sebayat_registrations sr ON sr.id = g.sebayat_id
      WHERE g.id = gumasta_approvals.gumasta_id
        AND sr.user_id = auth.uid()
    )
  );

-- Admins and superadmins can insert their own vote
CREATE POLICY "Admins can insert own gumasta vote"
  ON gumasta_approvals FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Admins and superadmins can update their own vote
CREATE POLICY "Admins can update own gumasta vote"
  ON gumasta_approvals FOR UPDATE
  TO authenticated
  USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

-- 4. System settings
INSERT INTO system_settings (setting_key, setting_value)
SELECT 'gumasta_approval_required', '{"value": true}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings WHERE setting_key = 'gumasta_approval_required'
);

INSERT INTO system_settings (setting_key, setting_value)
SELECT 'gumasta_approval_rule', '{"value": "any_admin"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings WHERE setting_key = 'gumasta_approval_rule'
);

-- Public read policies for the new settings
CREATE POLICY "Authenticated can read gumasta approval settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (
    setting_key IN ('gumasta_approval_required', 'gumasta_approval_rule')
  );

-- 5. Resolve function
CREATE OR REPLACE FUNCTION resolve_gumasta_status(p_gumasta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_count    integer;
  v_approved_count integer;
  v_rejected_count integer;
  v_majority       integer;
  v_rule           text;
  v_last_rejecter  record;
  v_last_approver  record;
BEGIN
  -- Check if approval is even required
  DECLARE
    v_required boolean;
  BEGIN
    SELECT COALESCE((setting_value->>'value')::boolean, true)
    INTO v_required
    FROM system_settings
    WHERE setting_key = 'gumasta_approval_required';

    IF NOT v_required THEN
      UPDATE gumastas
      SET approval_status = 'approved',
          rejection_reason = null,
          approved_at = now(),
          rejected_at = null,
          updated_at = now()
      WHERE id = p_gumasta_id
        AND approval_status = 'pending';
      RETURN;
    END IF;
  END;

  -- Read the active rule
  SELECT COALESCE(setting_value->>'value', 'any_admin')
  INTO v_rule
  FROM system_settings
  WHERE setting_key = 'gumasta_approval_rule';

  IF v_rule IS NULL THEN
    v_rule := 'any_admin';
  END IF;

  -- superadmin_only: admin votes have no effect
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
    COUNT(*) FILTER (WHERE action = 'rejected')
  INTO v_approved_count, v_rejected_count
  FROM gumasta_approvals
  WHERE gumasta_id = p_gumasta_id;

  -- Helper records
  SELECT admin_id, rejection_reason INTO v_last_rejecter
  FROM gumasta_approvals
  WHERE gumasta_id = p_gumasta_id AND action = 'rejected'
  ORDER BY updated_at DESC LIMIT 1;

  SELECT admin_id INTO v_last_approver
  FROM gumasta_approvals
  WHERE gumasta_id = p_gumasta_id AND action = 'approved'
  ORDER BY updated_at DESC LIMIT 1;

  -- ── ALL ADMINS ──────────────────────────────────────────────────────────────
  IF v_rule = 'all_admins' THEN
    IF v_rejected_count > 0 THEN
      UPDATE gumastas
      SET approval_status = 'rejected',
          rejection_reason = v_last_rejecter.rejection_reason,
          rejected_at = now(),
          approved_at = null,
          updated_at = now()
      WHERE id = p_gumasta_id;
      RETURN;
    END IF;

    IF v_approved_count = v_admin_count THEN
      UPDATE gumastas
      SET approval_status = 'approved',
          rejection_reason = null,
          approved_at = now(),
          rejected_at = null,
          updated_at = now()
      WHERE id = p_gumasta_id;
    END IF;
    RETURN;
  END IF;

  -- ── MAJORITY ────────────────────────────────────────────────────────────────
  IF v_rule = 'majority' THEN
    v_majority := (v_admin_count / 2) + 1;

    IF v_approved_count >= v_majority THEN
      UPDATE gumastas
      SET approval_status = 'approved',
          rejection_reason = null,
          approved_at = now(),
          rejected_at = null,
          updated_at = now()
      WHERE id = p_gumasta_id;
      RETURN;
    END IF;

    IF v_rejected_count >= v_majority THEN
      UPDATE gumastas
      SET approval_status = 'rejected',
          rejection_reason = v_last_rejecter.rejection_reason,
          rejected_at = now(),
          approved_at = null,
          updated_at = now()
      WHERE id = p_gumasta_id;
    END IF;
    RETURN;
  END IF;

  -- ── ANY ADMIN ───────────────────────────────────────────────────────────────
  IF v_rule = 'any_admin' THEN
    IF v_approved_count >= 1 THEN
      UPDATE gumastas
      SET approval_status = 'approved',
          rejection_reason = null,
          approved_at = now(),
          rejected_at = null,
          updated_at = now()
      WHERE id = p_gumasta_id;
      RETURN;
    END IF;

    IF v_rejected_count >= 1 THEN
      UPDATE gumastas
      SET approval_status = 'rejected',
          rejection_reason = v_last_rejecter.rejection_reason,
          rejected_at = now(),
          approved_at = null,
          updated_at = now()
      WHERE id = p_gumasta_id;
    END IF;
    RETURN;
  END IF;

END;
$$;

-- 6. Trigger function wrapper
CREATE OR REPLACE FUNCTION trigger_resolve_gumasta_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM resolve_gumasta_status(NEW.gumasta_id);
  RETURN NEW;
END;
$$;

-- 7. Trigger on gumasta_approvals
DROP TRIGGER IF EXISTS on_gumasta_approval_change ON gumasta_approvals;
CREATE TRIGGER on_gumasta_approval_change
  AFTER INSERT OR UPDATE ON gumasta_approvals
  FOR EACH ROW
  EXECUTE FUNCTION trigger_resolve_gumasta_status();

-- 8. Policy: admins can update gumastas approval_status (the trigger does this via SECURITY DEFINER, but direct superadmin override needs UPDATE)
CREATE POLICY "Admins can update gumasta approval fields"
  ON gumastas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );
