/*
  # Drop old apply_inner_gate_event overload

  The newer migration (20260516105146) created an extended version of
  apply_inner_gate_event with 15 parameters (9 optional with defaults).
  The original 6-parameter version from 20260514055716 still exists, causing
  the same "could not choose best candidate function" ambiguity error.

  This migration drops the old 6-parameter overload so only the current
  15-parameter version remains.
*/

DROP FUNCTION IF EXISTS apply_inner_gate_event(text, uuid, integer, timestamptz, text, text);
