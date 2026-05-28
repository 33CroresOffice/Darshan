/*
  # Backfill category_id from category_ids

  The registration form saves selected categories to the `category_ids` array column,
  but the `category_id` FK column (used for joining category name in entry details)
  was never populated. This migration backfills `category_id` with the first element
  of `category_ids` for all rows where `category_id` is NULL but `category_ids` is set.
*/

UPDATE sebayat_registrations
SET category_id = (category_ids)[1]
WHERE category_id IS NULL
  AND category_ids IS NOT NULL
  AND array_length(category_ids, 1) > 0;
