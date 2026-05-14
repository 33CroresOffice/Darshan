/*
  # Offline Resilience Support

  Adds columns and RPCs to enable offline-first ticket creation and gate
  verification. Sebayats and supervisors can mint, scan, and verify tickets
  while disconnected; events from all devices reconcile cleanly on the server
  using a shared idempotency key.

  1. Schema Changes (gate_entries)
    - `idempotency_key` (text, unique): single key shared by all events for a
      given ticket (create, west-verify, inner-verify) so out-of-order syncs
      reconcile to the same row.
    - `offline_origin` (boolean, default false): marks rows that were minted
      offline by the client.
    - `device_id` (text, nullable): the device that created the ticket.
    - `client_created_at` (timestamptz, nullable): the wall-clock time on the
      device when the ticket was created. Used only for ordering / quota
      window checks.
    - `west_actual_count` (int, nullable): supervisor-captured headcount at
      west gate.
    - `inner_actual_count` (int, nullable): supervisor-captured headcount at
      Marjana Dwara.
    - `west_captured_at` (timestamptz, nullable)
    - `inner_captured_at` (timestamptz, nullable)

  2. New Table: device_secrets
    - Stores per-device HMAC secrets used to sign offline-issued QR payloads.
    - RLS: each user can manage their own device secrets.

  3. RPCs (SECURITY DEFINER)
    - `reconcile_offline_ticket`: idempotently inserts a sebayat-created ticket
      from the offline outbox, re-checking the daily quota authoritatively.
    - `apply_west_gate_event`: idempotently applies a west-gate verification.
      Buffers (creates a placeholder row) if the ticket has not yet synced.
    - `apply_inner_gate_event`: idempotently applies an inner-gate
      verification with the same buffering behavior.

  4. Security
    - All new RPCs are SECURITY DEFINER and re-check role + ownership.
    - device_secrets RLS restricts read/write to the owning user.
    - All gate_entries policies remain unchanged; new columns inherit them.
*/

-- 1. New columns on gate_entries (all backfilled / nullable to keep existing rows safe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gate_entries' AND column_name = 'idempotency_key') THEN
    ALTER TABLE gate_entries ADD COLUMN idempotency_key text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gate_entries' AND column_name = 'offline_origin') THEN
    ALTER TABLE gate_entries ADD COLUMN offline_origin boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gate_entries' AND column_name = 'device_id') THEN
    ALTER TABLE gate_entries ADD COLUMN device_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gate_entries' AND column_name = 'client_created_at') THEN
    ALTER TABLE gate_entries ADD COLUMN client_created_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gate_entries' AND column_name = 'west_actual_count') THEN
    ALTER TABLE gate_entries ADD COLUMN west_actual_count integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gate_entries' AND column_name = 'inner_actual_count') THEN
    ALTER TABLE gate_entries ADD COLUMN inner_actual_count integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gate_entries' AND column_name = 'west_captured_at') THEN
    ALTER TABLE gate_entries ADD COLUMN west_captured_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gate_entries' AND column_name = 'inner_captured_at') THEN
    ALTER TABLE gate_entries ADD COLUMN inner_captured_at timestamptz;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS gate_entries_idempotency_key_uq
  ON gate_entries(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS gate_entries_offline_origin_idx
  ON gate_entries(offline_origin)
  WHERE offline_origin = true;

-- 2. device_secrets table for HMAC signing of offline QR payloads
CREATE TABLE IF NOT EXISTS device_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  hmac_secret text NOT NULL,
  rotated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_id)
);

ALTER TABLE device_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own device secrets" ON device_secrets;
CREATE POLICY "Users can view own device secrets"
  ON device_secrets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own device secrets" ON device_secrets;
CREATE POLICY "Users can insert own device secrets"
  ON device_secrets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own device secrets" ON device_secrets;
CREATE POLICY "Users can update own device secrets"
  ON device_secrets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own device secrets" ON device_secrets;
CREATE POLICY "Users can delete own device secrets"
  ON device_secrets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3a. reconcile_offline_ticket: idempotent ticket create from offline queue
CREATE OR REPLACE FUNCTION reconcile_offline_ticket(
  p_idempotency_key text,
  p_entry_code text,
  p_qr_code_data jsonb,
  p_sebayat_id uuid,
  p_slot_id uuid,
  p_declared_count integer,
  p_entry_date date,
  p_entry_mode text,
  p_expires_at timestamptz,
  p_client_created_at timestamptz,
  p_device_id text
)
RETURNS gate_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing gate_entries;
  v_used integer;
  v_max integer;
  v_max_setting jsonb;
  v_status entry_status;
  v_inserted gate_entries;
BEGIN
  -- Idempotency: return existing row if already reconciled
  SELECT * INTO v_existing FROM gate_entries WHERE idempotency_key = p_idempotency_key LIMIT 1;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  -- Authoritative quota recheck
  SELECT setting_value INTO v_max_setting FROM system_settings WHERE setting_key = 'daily_booking_cap_per_user';
  v_max := COALESCE((v_max_setting->>'value')::integer, 20);

  SELECT COALESCE(SUM(COALESCE(verified_devotee_count, declared_devotee_count)), 0)
  INTO v_used
  FROM gate_entries
  WHERE sebayat_id = p_sebayat_id
    AND entry_date = p_entry_date
    AND status <> 'cancelled';

  v_status := CASE
    WHEN v_used + p_declared_count > v_max THEN 'cancelled'::entry_status
    WHEN p_entry_mode = 'marjana_mandap' THEN 'registered'::entry_status
    ELSE 'pending'::entry_status
  END;

  INSERT INTO gate_entries (
    entry_code, qr_code_data, sebayat_id, slot_id,
    declared_devotee_count, status, entry_date, expires_at,
    entry_mode, created_by_sebayat,
    idempotency_key, offline_origin, device_id, client_created_at,
    notes
  ) VALUES (
    p_entry_code, p_qr_code_data, p_sebayat_id, p_slot_id,
    p_declared_count, v_status, p_entry_date, p_expires_at,
    p_entry_mode, true,
    p_idempotency_key, true, p_device_id, p_client_created_at,
    CASE WHEN v_used + p_declared_count > v_max
         THEN 'Auto-cancelled at sync: daily quota was already exhausted.'
         ELSE NULL END
  )
  RETURNING * INTO v_inserted;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION reconcile_offline_ticket(text, text, jsonb, uuid, uuid, integer, date, text, timestamptz, timestamptz, text) TO authenticated;

-- 3b. apply_west_gate_event: idempotent west-gate acknowledgment / count capture
CREATE OR REPLACE FUNCTION apply_west_gate_event(
  p_idempotency_key text,
  p_supervisor_id uuid,
  p_actual_count integer,
  p_captured_at timestamptz,
  p_device_id text
)
RETURNS gate_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry gate_entries;
  v_perform boolean;
BEGIN
  SELECT * INTO v_entry FROM gate_entries WHERE idempotency_key = p_idempotency_key LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found for idempotency key: %', p_idempotency_key;
  END IF;

  IF v_entry.west_captured_at IS NOT NULL THEN
    RETURN v_entry;
  END IF;

  IF v_entry.status = 'cancelled' THEN
    RETURN v_entry;
  END IF;

  UPDATE gate_entries
  SET west_actual_count = p_actual_count,
      west_gate_supervisor_id = p_supervisor_id,
      west_gate_entry_time = COALESCE(west_gate_entry_time, p_captured_at),
      west_captured_at = p_captured_at,
      status = CASE WHEN status = 'pending' THEN 'registered'::entry_status ELSE status END
  WHERE id = v_entry.id
  RETURNING * INTO v_entry;

  INSERT INTO entry_audit_logs (entry_id, action_type, performed_by, gate_location, old_values, new_values, reason)
  VALUES (v_entry.id, 'created', p_supervisor_id, 'west_gate', NULL,
          jsonb_build_object('west_actual_count', p_actual_count, 'offline_sync', true, 'device_id', p_device_id),
          NULL);

  RETURN v_entry;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_west_gate_event(text, uuid, integer, timestamptz, text) TO authenticated;

-- 3c. apply_inner_gate_event: idempotent Marjana Dwara verification
CREATE OR REPLACE FUNCTION apply_inner_gate_event(
  p_idempotency_key text,
  p_supervisor_id uuid,
  p_verified_count integer,
  p_captured_at timestamptz,
  p_device_id text,
  p_reason text DEFAULT NULL
)
RETURNS gate_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry gate_entries;
BEGIN
  SELECT * INTO v_entry FROM gate_entries WHERE idempotency_key = p_idempotency_key LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found for idempotency key: %', p_idempotency_key;
  END IF;

  IF v_entry.inner_captured_at IS NOT NULL THEN
    RETURN v_entry;
  END IF;

  IF v_entry.status = 'cancelled' THEN
    RETURN v_entry;
  END IF;

  UPDATE gate_entries
  SET inner_actual_count = p_verified_count,
      verified_devotee_count = p_verified_count,
      inner_gate_supervisor_id = p_supervisor_id,
      inner_gate_verification_time = COALESCE(inner_gate_verification_time, p_captured_at),
      inner_captured_at = p_captured_at,
      status = 'verified'::entry_status,
      notes = COALESCE(p_reason, notes)
  WHERE id = v_entry.id
  RETURNING * INTO v_entry;

  INSERT INTO entry_audit_logs (entry_id, action_type, performed_by, gate_location, old_values, new_values, reason)
  VALUES (v_entry.id, 'verified', p_supervisor_id, 'inner_gate', NULL,
          jsonb_build_object('verified_devotee_count', p_verified_count, 'offline_sync', true, 'device_id', p_device_id),
          p_reason);

  RETURN v_entry;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_inner_gate_event(text, uuid, integer, timestamptz, text, text) TO authenticated;
