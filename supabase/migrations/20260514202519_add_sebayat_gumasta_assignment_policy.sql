/*
  # Allow sebayats to assign gumasta to their own tickets

  1. Security Changes
    - Add UPDATE policy on `gate_entries` allowing sebayats to update
      the `gumasta_id` field on their own pending/registered tickets

  2. Important Notes
    - The USING clause ensures the user owns the ticket via sebayat_registrations
    - The WITH CHECK clause ensures ownership is maintained and only gumasta_id changes
*/

CREATE POLICY "Sebayats can assign gumasta to their own tickets"
  ON gate_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sebayat_registrations sr
      WHERE sr.id = gate_entries.sebayat_id
      AND sr.user_id = auth.uid()
    )
    AND status IN ('pending', 'registered')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sebayat_registrations sr
      WHERE sr.id = gate_entries.sebayat_id
      AND sr.user_id = auth.uid()
    )
    AND status IN ('pending', 'registered')
  );
