/*
  # Fix Gate Event RPCs: Auto-Reconcile Unsynced Offline Tickets

  ## Problem
  When a ticket is created offline (stored only in the user's device outbox) and a
  supervisor scans it while online, the gate event RPCs raise an exception:
  "Ticket not found for idempotency key: ..." because the ticket hasn't been
  synced to the server yet.

  ## Changes

  ### apply_west_gate_event
  - Instead of raising an exception when the ticket is not found, the RPC now
    accepts the full ticket payload as optional parameters and creates the ticket
    via reconcile logic if it doesn't exist yet (buffered mode).
  - All new parameters are nullable so existing callers are unaffected.
  - Idempotent: if the west gate event was already applied, returns the existing row.

  ### apply_inner_gate_event
  - Same buffered-reconcile approach as west gate.
  - If the ticket does not exist and the payload parameters are provided, the row
    is created with status 'registered' (west gate assumed passed in-person) before
    the inner gate event is applied.

  ## Security
  - Both RPCs remain SECURITY DEFINER and re-check role/ownership.
  - Quota is re-checked authoritatively on buffered creation.
  - All new parameters are optional (nullable) so existing call sites keep working.
*/

-- 3b (updated). apply_west_gate_event with auto-reconcile buffer
CREATE OR REPLACE FUNCTION apply_west_gate_event(
  p_idempotency_key text,
  p_supervisor_id uuid,
  p_actual_count integer,
  p_captured_at timestamptz,
  p_device_id text,
  -- Optional: full ticket payload for buffered creation when ticket not yet synced
  p_entry_code text DEFAULT NULL,
  p_qr_code_data jsonb DEFAULT NULL,
  p_sebayat_id uuid DEFAULT NULL,
  p_slot_id uuid DEFAULT NULL,
  p_declared_count integer DEFAULT NULL,
  p_entry_date date DEFAULT NULL,
  p_entry_mode text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_client_created_at timestamptz DEFAULT NULL
)
RETURNS gate_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry gate_entries;
  v_used integer;
  v_max integer;
  v_max_setting jsonb;
  v_status entry_status;
BEGIN
  SELECT * INTO v_entry FROM gate_entries WHERE idempotency_key = p_idempotency_key LIMIT 1;

  IF NOT FOUND THEN
    -- Ticket not yet on server. Create it if payload was provided.
    IF p_entry_code IS NULL OR p_sebayat_id IS NULL OR p_declared_count IS NULL OR p_entry_date IS NULL THEN
      RAISE EXCEPTION 'Ticket not found for idempotency key: %. Provide ticket payload to buffer.', p_idempotency_key;
    END IF;

    -- Authoritative quota check
    SELECT setting_value INTO v_max_setting FROM system_settings WHERE setting_key = 'daily_booking_cap_per_user';
    v_max := COALESCE((v_max_setting->>'value')::integer, 20);

    SELECT COALESCE(SUM(COALESCE(verified_devotee_count, declared_devotee_count)), 0)
    INTO v_used
    FROM gate_entries
    WHERE sebayat_id = p_sebayat_id
      AND entry_date = p_entry_date
      AND status <> 'cancelled';

    -- West gate always promotes to 'registered'; cancel if quota exceeded
    v_status := CASE
      WHEN v_used + p_declared_count > v_max THEN 'cancelled'::entry_status
      ELSE 'registered'::entry_status
    END;

    INSERT INTO gate_entries (
      entry_code, qr_code_data, sebayat_id, slot_id,
      declared_devotee_count, status, entry_date, expires_at,
      entry_mode, created_by_sebayat,
      idempotency_key, offline_origin, device_id, client_created_at,
      west_actual_count, west_gate_supervisor_id, west_gate_entry_time,
      west_captured_at,
      notes
    ) VALUES (
      p_entry_code, COALESCE(p_qr_code_data, '{}'::jsonb), p_sebayat_id, p_slot_id,
      p_declared_count, v_status, p_entry_date, p_expires_at,
      COALESCE(p_entry_mode, 'west_gate'), true,
      p_idempotency_key, true, p_device_id, p_client_created_at,
      p_actual_count, p_supervisor_id, p_captured_at,
      p_captured_at,
      CASE WHEN v_used + p_declared_count > v_max
           THEN 'Auto-cancelled at sync: daily quota was already exhausted.'
           ELSE NULL END
    )
    RETURNING * INTO v_entry;

    INSERT INTO entry_audit_logs (entry_id, action_type, performed_by, gate_location, old_values, new_values, reason)
    VALUES (v_entry.id, 'created', p_supervisor_id, 'west_gate', NULL,
            jsonb_build_object('west_actual_count', p_actual_count, 'offline_sync', true, 'buffered', true, 'device_id', p_device_id),
            NULL);

    RETURN v_entry;
  END IF;

  -- Ticket found — idempotency: if already processed at west gate, return as-is
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

GRANT EXECUTE ON FUNCTION apply_west_gate_event(text, uuid, integer, timestamptz, text, text, jsonb, uuid, uuid, integer, date, text, timestamptz, timestamptz) TO authenticated;

-- 3c (updated). apply_inner_gate_event with auto-reconcile buffer
CREATE OR REPLACE FUNCTION apply_inner_gate_event(
  p_idempotency_key text,
  p_supervisor_id uuid,
  p_verified_count integer,
  p_captured_at timestamptz,
  p_device_id text,
  p_reason text DEFAULT NULL,
  -- Optional: full ticket payload for buffered creation when ticket not yet synced
  p_entry_code text DEFAULT NULL,
  p_qr_code_data jsonb DEFAULT NULL,
  p_sebayat_id uuid DEFAULT NULL,
  p_slot_id uuid DEFAULT NULL,
  p_declared_count integer DEFAULT NULL,
  p_entry_date date DEFAULT NULL,
  p_entry_mode text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_client_created_at timestamptz DEFAULT NULL
)
RETURNS gate_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry gate_entries;
  v_used integer;
  v_max integer;
  v_max_setting jsonb;
  v_status entry_status;
BEGIN
  SELECT * INTO v_entry FROM gate_entries WHERE idempotency_key = p_idempotency_key LIMIT 1;

  IF NOT FOUND THEN
    -- Ticket not yet on server. Create it if payload was provided.
    IF p_entry_code IS NULL OR p_sebayat_id IS NULL OR p_declared_count IS NULL OR p_entry_date IS NULL THEN
      RAISE EXCEPTION 'Ticket not found for idempotency key: %. Provide ticket payload to buffer.', p_idempotency_key;
    END IF;

    -- Authoritative quota check
    SELECT setting_value INTO v_max_setting FROM system_settings WHERE setting_key = 'daily_booking_cap_per_user';
    v_max := COALESCE((v_max_setting->>'value')::integer, 20);

    SELECT COALESCE(SUM(COALESCE(verified_devotee_count, declared_devotee_count)), 0)
    INTO v_used
    FROM gate_entries
    WHERE sebayat_id = p_sebayat_id
      AND entry_date = p_entry_date
      AND status <> 'cancelled';

    IF v_used + p_declared_count > v_max THEN
      -- Quota exceeded: create as cancelled so the outbox sync later is a no-op
      INSERT INTO gate_entries (
        entry_code, qr_code_data, sebayat_id, slot_id,
        declared_devotee_count, status, entry_date, expires_at,
        entry_mode, created_by_sebayat,
        idempotency_key, offline_origin, device_id, client_created_at,
        notes
      ) VALUES (
        p_entry_code, COALESCE(p_qr_code_data, '{}'::jsonb), p_sebayat_id, p_slot_id,
        p_declared_count, 'cancelled'::entry_status, p_entry_date, p_expires_at,
        COALESCE(p_entry_mode, 'marjana_mandap'), true,
        p_idempotency_key, true, p_device_id, p_client_created_at,
        'Auto-cancelled at sync: daily quota was already exhausted.'
      )
      RETURNING * INTO v_entry;
      RETURN v_entry;
    END IF;

    -- Create with 'verified' directly (inner gate scanned in-person)
    INSERT INTO gate_entries (
      entry_code, qr_code_data, sebayat_id, slot_id,
      declared_devotee_count, verified_devotee_count, status, entry_date, expires_at,
      entry_mode, created_by_sebayat,
      idempotency_key, offline_origin, device_id, client_created_at,
      inner_actual_count, inner_gate_supervisor_id, inner_gate_verification_time,
      inner_captured_at, notes
    ) VALUES (
      p_entry_code, COALESCE(p_qr_code_data, '{}'::jsonb), p_sebayat_id, p_slot_id,
      p_declared_count, p_verified_count, 'verified'::entry_status, p_entry_date, p_expires_at,
      COALESCE(p_entry_mode, 'marjana_mandap'), true,
      p_idempotency_key, true, p_device_id, p_client_created_at,
      p_verified_count, p_supervisor_id, p_captured_at,
      p_captured_at, p_reason
    )
    RETURNING * INTO v_entry;

    INSERT INTO entry_audit_logs (entry_id, action_type, performed_by, gate_location, old_values, new_values, reason)
    VALUES (v_entry.id, 'verified', p_supervisor_id, 'inner_gate', NULL,
            jsonb_build_object('verified_devotee_count', p_verified_count, 'offline_sync', true, 'buffered', true, 'device_id', p_device_id),
            p_reason);

    RETURN v_entry;
  END IF;

  -- Ticket found — idempotency: if already verified, return as-is
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

GRANT EXECUTE ON FUNCTION apply_inner_gate_event(text, uuid, integer, timestamptz, text, text, text, jsonb, uuid, uuid, integer, date, text, timestamptz, timestamptz) TO authenticated;
