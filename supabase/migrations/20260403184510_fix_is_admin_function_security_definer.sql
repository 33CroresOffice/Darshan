/*
  # Fix is_admin_or_superadmin function to bypass RLS

  1. Changes
    - Drop and recreate `is_admin_or_superadmin()` function with SECURITY DEFINER
    - This allows the function to bypass RLS when checking user roles
    - Prevents infinite recursion when RLS policies call this function

  2. Security
    - Function runs with owner privileges (bypasses RLS)
    - Only returns a boolean, does not expose sensitive data
*/

CREATE OR REPLACE FUNCTION is_admin_or_superadmin()
RETURNS BOOLEAN
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