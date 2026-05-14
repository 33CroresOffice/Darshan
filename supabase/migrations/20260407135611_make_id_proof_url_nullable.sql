/*
  # Make id_proof_url nullable

  ## Summary
  The registration form no longer requires an Aadhaar/ID proof upload as a mandatory
  field — users may optionally upload a Temple ID Card instead. This migration makes
  the `id_proof_url` column nullable so that registrations without an ID proof image
  can be saved successfully.

  ## Changes
  - `sebayat_registrations.id_proof_url`: changed from NOT NULL to nullable
*/

ALTER TABLE sebayat_registrations
  ALTER COLUMN id_proof_url DROP NOT NULL;
