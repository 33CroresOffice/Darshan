/*
  # Add entry_mode to gate_entries

  Adds an `entry_mode` column to `gate_entries` to distinguish between:
  - `west_gate`: Standard two-checkpoint flow (West Gate → Marjana Mandap)
  - `marjana_mandap`: Direct single-checkpoint flow (Marjana Mandap only, bypasses West Gate)

  ## Changes
  - `gate_entries.entry_mode` (text, NOT NULL, DEFAULT 'west_gate')
    - Constrained to 'west_gate' | 'marjana_mandap'
    - All existing entries default to 'west_gate' (fully backwards-compatible)

  ## Behaviour
  - When entry_mode = 'west_gate': ticket starts as 'pending', must be acknowledged at West Gate
  - When entry_mode = 'marjana_mandap': ticket starts as 'registered', skips West Gate entirely
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gate_entries' AND column_name = 'entry_mode'
  ) THEN
    ALTER TABLE gate_entries
      ADD COLUMN entry_mode text NOT NULL DEFAULT 'west_gate'
      CHECK (entry_mode IN ('west_gate', 'marjana_mandap'));
  END IF;
END $$;
