/*
  # Fix Profiles RLS Infinite Recursion

  1. Problem
    - The "Admins can read all profiles" policy queries the profiles table itself
    - This causes infinite recursion when PostgreSQL tries to evaluate the policy

  2. Solution
    - Create a helper function that uses SECURITY DEFINER to bypass RLS
    - Replace the problematic policy with one that uses this function

  3. Security
    - The function only checks if the current user is an admin
    - It does not expose any profile data
*/

CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  );
$$;

DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_superadmin());