/*
  # Enable Realtime for Profiles Table

  ## Summary
  Enables Supabase Realtime publication for the profiles table so that
  clients subscribed to profile changes receive immediate updates when
  a user's is_active status (or any other field) is modified by an admin.

  ## Changes
  - Adds the profiles table to the supabase_realtime publication
  - This allows the frontend to listen for UPDATE events on individual
    profile rows and react accordingly (e.g., auto sign-out disabled users)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  END IF;
END $$;
