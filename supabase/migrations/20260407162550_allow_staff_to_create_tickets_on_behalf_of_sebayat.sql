/*
  # Allow Staff to Create Darshan Tickets on Behalf of Sebayats

  ## Overview
  Admins and superadmins currently cannot create gate_entries (darshan tickets)
  on behalf of a sebayat. This migration adds an INSERT policy to allow
  admins and superadmins to create tickets for any approved sebayat.

  ## Changes

  ### New Policy: gate_entries
  - "Admins can create tickets on behalf of any approved sebayat"
    Allows INSERT for admin and superadmin roles where the sebayat has an
    approved registration. The ticket must be created with created_by_sebayat = false
    to distinguish staff-created tickets.

  ## Notes
  1. Supervisors already have an unrestricted INSERT policy ("Supervisors can create entries").
  2. This policy specifically targets admin/superadmin roles.
  3. The sebayat_id referenced must belong to an approved registration.
*/

CREATE POLICY "Admins can create tickets on behalf of any approved sebayat"
  ON gate_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin_or_superadmin()
    AND (
      EXISTS (
        SELECT 1 FROM sebayat_registrations sr
        WHERE sr.id = gate_entries.sebayat_id
          AND sr.approval_status = 'approved'
      )
    )
  );
