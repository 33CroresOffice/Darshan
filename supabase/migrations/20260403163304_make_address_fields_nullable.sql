/*
  # Make Address and DOB Fields Nullable

  1. Changes
    - Makes `address`, `city`, `state`, `pincode`, and `date_of_birth` columns nullable
    - This allows users to register without providing these fields initially
    - Users can add this information later on their profile page

  2. Notes
    - These fields were previously required but are now optional during registration
    - Users will see a "Complete Your Profile" banner if these fields are not filled
*/

ALTER TABLE sebayat_registrations
  ALTER COLUMN address DROP NOT NULL,
  ALTER COLUMN city DROP NOT NULL,
  ALTER COLUMN state DROP NOT NULL,
  ALTER COLUMN pincode DROP NOT NULL,
  ALTER COLUMN date_of_birth DROP NOT NULL;