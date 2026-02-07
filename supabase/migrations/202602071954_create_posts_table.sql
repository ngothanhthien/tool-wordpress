-- Create posts table for WordPress blog sync
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wordpress_id BIGINT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  excerpt TEXT,
  featured_image_url TEXT,
  featured_image_alt TEXT,
  status TEXT NOT NULL CHECK (status IN ('publish', 'draft', 'pending', 'private', 'trash')),
  wordpress_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  wordpress_date TIMESTAMPTZ,
  wordpress_modified TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),

  author_id BIGINT,
  author_name TEXT,

  seo_title TEXT,
  seo_description TEXT,
  seo_focus_keyword TEXT,

  categories JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_posts_wordpress_id ON posts(wordpress_id);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_wordpress_date ON posts(wordpress_date DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read posts
CREATE POLICY "Allow authenticated read" ON posts
  FOR SELECT TO authenticated
  USING (true);

-- Policy: Allow service role to insert/update posts
CREATE POLICY "Allow service role write" ON posts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
