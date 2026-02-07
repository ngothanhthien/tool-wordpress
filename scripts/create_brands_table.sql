-- Run this in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS product_brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS product_brands_slug_idx ON product_brands (slug);
CREATE INDEX IF NOT EXISTS product_brands_name_idx ON product_brands (name);
