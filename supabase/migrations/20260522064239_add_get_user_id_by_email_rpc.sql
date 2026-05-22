/*
  # Add get_user_id_by_email RPC

  Exposes a security-definer function callable by the service role
  to look up an auth.users row by email without exposing the full
  auth schema to the public role.
*/

CREATE OR REPLACE FUNCTION get_user_id_by_email(p_email text)
RETURNS TABLE(id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth
AS $$
  SELECT id FROM auth.users WHERE email = p_email LIMIT 1;
$$;
