/*
  # Add Ticket Expiration and Sebayat Policies

  1. Schema Changes
    - Make west_gate_supervisor_id nullable (sebayat creates first, supervisor acknowledges later)
    - Add created_by_sebayat boolean column to distinguish self-created tickets
    - Add expires_at timestamp column for ticket expiration tracking

  2. Security
    - Add RLS policy allowing sebayats to create tickets for their own registration
    - Add RLS policy allowing sebayats to cancel their own pending tickets
    - Add RLS policy allowing sebayats to view their own entries

  3. Notes
    - West gate changes status from 'pending' to 'registered'
    - Inner gate only sees 'registered' entries
*/

-- Make west_gate_supervisor_id nullable (sebayat creates ticket first, supervisor fills later)
ALTER TABLE gate_entries ALTER COLUMN west_gate_supervisor_id DROP NOT NULL;

-- Add created_by_sebayat column to distinguish self-created tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gate_entries' AND column_name = 'created_by_sebayat'
  ) THEN
    ALTER TABLE gate_entries ADD COLUMN created_by_sebayat boolean DEFAULT false;
  END IF;
END $$;

-- Add expires_at column for ticket expiration tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gate_entries' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE gate_entries ADD COLUMN expires_at timestamptz;
  END IF;
END $$;

-- Create policy for sebayats to create their own tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'gate_entries' AND policyname = 'Sebayats can create their own tickets'
  ) THEN
    CREATE POLICY "Sebayats can create their own tickets"
      ON gate_entries
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM sebayat_registrations sr
          WHERE sr.id = sebayat_id
          AND sr.user_id = auth.uid()
          AND sr.approval_status = 'approved'
        )
      );
  END IF;
END $$;

-- Create policy for sebayats to cancel their own pending tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'gate_entries' AND policyname = 'Sebayats can cancel their own pending tickets'
  ) THEN
    CREATE POLICY "Sebayats can cancel their own pending tickets"
      ON gate_entries
      FOR UPDATE
      TO authenticated
      USING (
        status = 'pending'
        AND EXISTS (
          SELECT 1 FROM sebayat_registrations sr
          WHERE sr.id = sebayat_id
          AND sr.user_id = auth.uid()
        )
      )
      WITH CHECK (
        status = 'cancelled'
        AND EXISTS (
          SELECT 1 FROM sebayat_registrations sr
          WHERE sr.id = sebayat_id
          AND sr.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Create policy for sebayats to read their own entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'gate_entries' AND policyname = 'Sebayats can view their own entries'
  ) THEN
    CREATE POLICY "Sebayats can view their own entries"
      ON gate_entries
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM sebayat_registrations sr
          WHERE sr.id = sebayat_id
          AND sr.user_id = auth.uid()
        )
      );
  END IF;
END $$;