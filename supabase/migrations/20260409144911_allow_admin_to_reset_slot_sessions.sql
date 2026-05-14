/*
  # Allow admins and superadmins to reset (delete) slot sessions

  ## Change
  - Add a DELETE policy on slot_sessions for superadmin and admin roles
  - Add a DELETE policy on slot_session_logs for superadmin and admin roles
  - This allows admins to reset today's slot sessions so supervisors can re-run slots

  ## Security
  - Only superadmin and admin roles can delete records
  - Supervisors and regular users cannot delete sessions
*/

CREATE POLICY "Admins can delete slot sessions"
  ON slot_sessions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role])
    )
  );

CREATE POLICY "Admins can delete slot session logs"
  ON slot_session_logs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role])
    )
  );
