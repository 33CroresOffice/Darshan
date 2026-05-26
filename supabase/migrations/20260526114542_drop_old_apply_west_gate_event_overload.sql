/*
  # Drop old apply_west_gate_event overload

  The newer migration (20260516105146) created an extended version of
  apply_west_gate_event with 14 parameters (9 optional with defaults).
  The original 5-parameter version from 20260514055716 still exists, causing
  PostgreSQL to raise "could not choose best candidate function" whenever the
  RPC is called with named parameters — PostgreSQL cannot disambiguate between
  the two overloads.

  This migration drops the old 5-parameter overload so only the current
  14-parameter version remains.
*/

DROP FUNCTION IF EXISTS apply_west_gate_event(text, uuid, integer, timestamptz, text);
