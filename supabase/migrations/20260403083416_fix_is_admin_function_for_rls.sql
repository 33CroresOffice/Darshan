/*
  # Fix is_admin_or_superadmin function for RLS

  1. Problem
    - The existing function may have caching or permission issues
    - Need to ensure SECURITY DEFINER is properly set to bypass RLS when checking role

  2. Solution
    - Drop policy first, then recreate function with explicit permissions
    - Ensure the function can read from profiles without triggering RLS recursion
*/

DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

DROP FUNCTION IF EXISTS public.is_admin_or_superadmin();

CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin', 'superadmin')
     FROM profiles
     WHERE id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_or_superadmin() TO authenticated;

CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_superadmin());
