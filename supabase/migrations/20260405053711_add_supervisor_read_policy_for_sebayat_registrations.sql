/*
  # Add supervisor read access to sebayat_registrations

  ## Problem
  Supervisors at the west gate need to search sebayat records by phone number
  or health card ID to process entries. Currently, the RLS policies only allow
  admins and the registration owner to read sebayat_registrations, so supervisor
  searches always return null.

  ## Changes
  - Adds a SELECT policy for users with the 'supervisor' role to read approved
    sebayat registrations only (not pending/rejected ones)
*/

CREATE POLICY "Supervisors can read approved registrations"
  ON sebayat_registrations
  FOR SELECT
  TO authenticated
  USING (
    approval_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'supervisor'
    )
  );
