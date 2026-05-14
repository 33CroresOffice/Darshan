/*
  # Add Feedback Table

  ## Summary
  Creates a feedback table to capture short feedback from supervisors and sebayat (app users).

  ## New Tables
  - `feedback`
    - `id` (uuid, primary key)
    - `user_id` (uuid, FK to auth.users)
    - `role` (text) - the submitter's role: 'supervisor' or 'sebayat'
    - `message` (text) - feedback text, max 50 words enforced at app level
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can insert their own feedback
  - Authenticated users can read only their own feedback
  - Admins and superadmins can read all feedback via is_admin_or_superadmin() helper
*/

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('supervisor', 'sebayat')),
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
  ON feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback"
  ON feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all feedback"
  ON feedback
  FOR SELECT
  TO authenticated
  USING (is_admin_or_superadmin());
