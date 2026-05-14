/*
  # Add Categories Table and Update Registrations

  1. New Tables
    - `categories`
      - `id` (uuid, primary key)
      - `name` (text, unique, NOT NULL) - category name like "Sebayat", "Palia", "Others"
      - `is_active` (boolean, default true) - soft delete support
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to Existing Tables
    - Add `category_id` column to `sebayat_registrations` (foreign key to categories)

  3. Security
    - Enable RLS on `categories` table
    - All authenticated users can read active categories
    - Only super admins can create/update/delete categories

  4. Seed Data
    - Insert initial categories: Sebayat, Palia, Others
*/

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active categories"
  ON categories
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Super admins can insert categories"
  ON categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  );

CREATE POLICY "Super admins can update categories"
  ON categories
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  );

CREATE POLICY "Super admins can delete categories"
  ON categories
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  );

INSERT INTO categories (name) VALUES
  ('Sebayat'),
  ('Palia'),
  ('Others')
ON CONFLICT (name) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayat_registrations' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE sebayat_registrations ADD COLUMN category_id uuid REFERENCES categories(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sebayat_registrations_category_id ON sebayat_registrations(category_id);