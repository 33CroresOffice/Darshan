/*
  # Allow Staff to Create Darshan Tickets

  1. Policy Changes
    - Update gate_entries INSERT policy to allow staff (supervisors, admins, superadmins) 
      to create entries for their own approved sebayat registrations
    - Staff members can create pending tickets just like regular sebayats
    - The same quota limits apply to staff members

  2. Security
    - Staff must have an approved sebayat_registration to create entries
    - Entries must be linked to the staff member's own registration
    - All existing validation (quota, expiration) still applies
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Sebayats can create their own pending entries' 
    AND tablename = 'gate_entries'
  ) THEN
    DROP POLICY "Sebayats can create their own pending entries" ON gate_entries;
  END IF;
END $$;

CREATE POLICY "Users with approved registration can create pending entries"
  ON gate_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status = 'pending'
    AND created_by_sebayat = true
    AND sebayat_id IN (
      SELECT id FROM sebayat_registrations 
      WHERE user_id = auth.uid() 
      AND approval_status = 'approved'
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Sebayats can view their own entries' 
    AND tablename = 'gate_entries'
  ) THEN
    DROP POLICY "Sebayats can view their own entries" ON gate_entries;
  END IF;
END $$;

CREATE POLICY "Users can view entries for their own registration"
  ON gate_entries
  FOR SELECT
  TO authenticated
  USING (
    sebayat_id IN (
      SELECT id FROM sebayat_registrations 
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('supervisor', 'admin', 'superadmin')
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Sebayats can cancel their own pending entries' 
    AND tablename = 'gate_entries'
  ) THEN
    DROP POLICY "Sebayats can cancel their own pending entries" ON gate_entries;
  END IF;
END $$;

CREATE POLICY "Users can cancel their own pending entries"
  ON gate_entries
  FOR UPDATE
  TO authenticated
  USING (
    status = 'pending'
    AND sebayat_id IN (
      SELECT id FROM sebayat_registrations 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'cancelled'
    AND sebayat_id IN (
      SELECT id FROM sebayat_registrations 
      WHERE user_id = auth.uid()
    )
  );
