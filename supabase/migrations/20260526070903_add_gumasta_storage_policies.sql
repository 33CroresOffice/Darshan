/*
  # Add storage policies for gumasta photo and Aadhaar uploads

  ## Changes
  - Add INSERT policy on profile-photos for authenticated users to upload to their own gumastas/ subfolder
  - Add INSERT policy on id-documents for authenticated users to upload to their own gumastas/ subfolder
  - Add UPDATE policy on profile-photos for the same path pattern
  - Add UPDATE policy on id-documents for the same path pattern

  ## Path structure
  Gumasta files are stored as: {userId}/gumastas/{gumastaId}.jpg
  The first folder segment is always the authenticated user's UUID, matching the existing policy pattern.
*/

-- Profile photos: allow upload to {uid}/gumastas/... paths
CREATE POLICY "Users can upload gumasta photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Profile photos: allow update to {uid}/gumastas/... paths  
CREATE POLICY "Users can update gumasta photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Id documents: allow upload to {uid}/gumastas/... paths
CREATE POLICY "Users can upload gumasta aadhar documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'id-documents'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Id documents: allow update to {uid}/gumastas/... paths
CREATE POLICY "Users can update gumasta aadhar documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'id-documents'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'id-documents'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
