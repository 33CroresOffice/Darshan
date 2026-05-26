/*
  # Drop duplicate storage policies added by mistake

  The previously added policies are identical in logic to the already-existing
  "Users can upload own profile photos" and "Users can upload own id documents" policies.
  Now that the upload paths start with the user's UUID (matching the existing policies),
  these duplicates are not needed.
*/

DROP POLICY IF EXISTS "Users can upload gumasta photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update gumasta photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload gumasta aadhar documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update gumasta aadhar documents" ON storage.objects;
