/*
# Create bills table (single-tenant, no auth)

1. New Tables
- `bills`
  - `id` (uuid, primary key)
  - `shop_name` (text, optional shop name shown on the bill)
  - `items` (jsonb, array of {name, price, qty} line items)
  - `total` (numeric, computed total amount)
  - `language` (text, 'hi' or 'en', the language used while billing)
  - `created_at` (timestamptz, when the bill was created)
2. Security
- Enable RLS on `bills`.
- Grant CRUD to `anon` + `authenticated` so the Data API can reach the table.
- Allow anon + authenticated CRUD because the data is intentionally shared/public (no sign-in).
3. Notes
- Single-tenant app: no user_id column, no auth.users reference.
- items stored as jsonb to keep the line-item structure flexible.
*/

CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name text DEFAULT 'My Shop',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON bills TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_bills" ON bills;
CREATE POLICY "anon_select_bills" ON bills FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_bills" ON bills;
CREATE POLICY "anon_insert_bills" ON bills FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_bills" ON bills;
CREATE POLICY "anon_update_bills" ON bills FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bills" ON bills;
CREATE POLICY "anon_delete_bills" ON bills FOR DELETE
TO anon, authenticated USING (true);
