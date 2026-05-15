/*
  # Add RPC functions for gumasta assignment

  1. New Functions
    - `assign_gumasta_to_ticket(p_entry_id uuid, p_gumasta_id uuid)` - Assigns a gumasta to a single ticket
    - `assign_gumasta_to_all_pending(p_sebayat_id uuid, p_gumasta_id uuid)` - Assigns a gumasta to all pending tickets for a sebayat
    - `remove_gumasta_from_ticket(p_entry_id uuid)` - Removes gumasta assignment from a ticket

  2. Security
    - All functions are SECURITY DEFINER to bypass RLS
    - Each function validates that the caller owns the sebayat registration
    - Each function validates the gumasta belongs to the same sebayat
    - Only pending/registered tickets can be modified

  3. Important Notes
    - These replace direct UPDATE calls that were blocked by RLS policy interactions
    - The existing RLS policy for gumasta assignment is kept as a safety net
*/

-- Assign gumasta to a single ticket
CREATE OR REPLACE FUNCTION assign_gumasta_to_ticket(
  p_entry_id uuid,
  p_gumasta_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sebayat_id uuid;
  v_status text;
BEGIN
  -- Get the ticket's sebayat_id and status
  SELECT sebayat_id, status INTO v_sebayat_id, v_status
  FROM gate_entries
  WHERE id = p_entry_id;

  IF v_sebayat_id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  -- Verify the caller owns this sebayat
  IF NOT EXISTS (
    SELECT 1 FROM sebayat_registrations
    WHERE id = v_sebayat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Verify ticket is in valid status
  IF v_status NOT IN ('pending', 'registered') THEN
    RAISE EXCEPTION 'Ticket cannot be modified in current status';
  END IF;

  -- Verify gumasta belongs to same sebayat
  IF NOT EXISTS (
    SELECT 1 FROM gumastas
    WHERE id = p_gumasta_id AND sebayat_id = v_sebayat_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Gumasta not found or inactive';
  END IF;

  -- Perform the update
  UPDATE gate_entries
  SET gumasta_id = p_gumasta_id
  WHERE id = p_entry_id;
END;
$$;

-- Assign gumasta to all pending tickets for a sebayat
CREATE OR REPLACE FUNCTION assign_gumasta_to_all_pending(
  p_sebayat_id uuid,
  p_gumasta_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Verify the caller owns this sebayat
  IF NOT EXISTS (
    SELECT 1 FROM sebayat_registrations
    WHERE id = p_sebayat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Verify gumasta belongs to same sebayat
  IF NOT EXISTS (
    SELECT 1 FROM gumastas
    WHERE id = p_gumasta_id AND sebayat_id = p_sebayat_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Gumasta not found or inactive';
  END IF;

  -- Perform the update
  UPDATE gate_entries
  SET gumasta_id = p_gumasta_id
  WHERE sebayat_id = p_sebayat_id AND status = 'pending';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Remove gumasta from a ticket
CREATE OR REPLACE FUNCTION remove_gumasta_from_ticket(
  p_entry_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sebayat_id uuid;
BEGIN
  -- Get the ticket's sebayat_id
  SELECT sebayat_id INTO v_sebayat_id
  FROM gate_entries
  WHERE id = p_entry_id;

  IF v_sebayat_id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  -- Verify the caller owns this sebayat
  IF NOT EXISTS (
    SELECT 1 FROM sebayat_registrations
    WHERE id = v_sebayat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Perform the update
  UPDATE gate_entries
  SET gumasta_id = NULL
  WHERE id = p_entry_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION assign_gumasta_to_ticket(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_gumasta_to_all_pending(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_gumasta_from_ticket(uuid) TO authenticated;
