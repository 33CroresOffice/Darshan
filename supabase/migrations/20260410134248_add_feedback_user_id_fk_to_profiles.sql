/*
  # Add FK from feedback.user_id to profiles.id

  ## Summary
  The feedback table's user_id column references auth.users but not profiles,
  so Supabase's auto-join doesn't work when selecting profile data.
  This migration adds a foreign key relationship to profiles so the join works correctly.

  ## Changes
  - Add FK constraint from feedback.user_id to profiles.id
*/

ALTER TABLE feedback
  ADD CONSTRAINT feedback_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
