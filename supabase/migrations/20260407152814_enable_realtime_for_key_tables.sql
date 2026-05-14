/*
  # Enable Realtime for Key Tables

  ## Summary
  Adds gate_entries, sebayat_registrations, and registration_approvals tables
  to the Supabase Realtime publication so that all connected clients receive
  live updates when records are inserted, updated, or deleted.

  ## Changes
  - Enables realtime on gate_entries (ticket status changes, new entries)
  - Enables realtime on sebayat_registrations (approval status changes)
  - Enables realtime on registration_approvals (admin votes)

  This powers the real-time UI updates across the app without requiring
  manual refreshes.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'gate_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE gate_entries;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sebayat_registrations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sebayat_registrations;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'registration_approvals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE registration_approvals;
  END IF;
END $$;
