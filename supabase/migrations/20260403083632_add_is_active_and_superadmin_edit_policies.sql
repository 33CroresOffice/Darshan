/*
  # Add is_active field and superadmin edit policies

  1. Schema Changes
    - Add `is_active` boolean column to profiles table with default true
    - This allows superadmins to disable/enable user accounts

  2. Security Changes
    - Add UPDATE policy for superadmins to edit any profile (except other superadmins)
    - This enables superadmins to edit admin names, phone numbers, and disable accounts

  3. Notes
    - Superadmins can edit admins and sebayats
    - Superadmins cannot edit other superadmins (security measure)
    - Users can still edit their own profiles
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'superadmin'
     FROM profiles
     WHERE id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

DROP POLICY IF EXISTS "Superadmins can update non-superadmin profiles" ON profiles;

CREATE POLICY "Superadmins can update non-superadmin profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    public.is_superadmin() 
    AND role != 'superadmin'
  )
  WITH CHECK (
    public.is_superadmin() 
    AND role != 'superadmin'
  );
