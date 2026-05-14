/*
  # Make west_gate_entry_time Nullable

  1. Schema Changes
    - Make west_gate_entry_time nullable to support sebayat-created tickets
    - Sebayat creates ticket first (no west gate time yet)
    - West gate supervisor acknowledges and sets the time

  2. Notes
    - This allows the two-step flow where sebayat creates ticket first
*/

ALTER TABLE gate_entries ALTER COLUMN west_gate_entry_time DROP NOT NULL;