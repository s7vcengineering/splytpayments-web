-- MVP Miami: Exotic Cars, Mansions, and MVP Yachts tables
-- Run this in your Supabase SQL editor

-- ============================================================
-- Exotic Cars
-- ============================================================
CREATE TABLE IF NOT EXISTS exotic_cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_provider TEXT NOT NULL DEFAULT 'mvpmiami',
  source_listing_id TEXT NOT NULL,
  source_url TEXT,
  title TEXT,
  year INTEGER,
  make TEXT,
  model TEXT,
  trim TEXT,
  body_style TEXT,
  exterior_color TEXT,
  interior_color TEXT,
  engine TEXT,
  transmission TEXT,
  drivetrain TEXT,
  horsepower INTEGER,
  top_speed INTEGER,
  zero_to_sixty NUMERIC(4,1),
  mileage INTEGER,
  daily_rate INTEGER,
  stock_number TEXT,
  vin TEXT,
  description TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  city TEXT DEFAULT 'Miami',
  region TEXT DEFAULT 'FL',
  contact_phone TEXT,
  contact_address TEXT,
  is_active BOOLEAN DEFAULT true,
  scrape_status TEXT DEFAULT 'pending',
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_provider, source_listing_id)
);

CREATE INDEX IF NOT EXISTS idx_exotic_cars_make ON exotic_cars(make);
CREATE INDEX IF NOT EXISTS idx_exotic_cars_city ON exotic_cars(city);
CREATE INDEX IF NOT EXISTS idx_exotic_cars_active ON exotic_cars(is_active);
CREATE INDEX IF NOT EXISTS idx_exotic_cars_daily_rate ON exotic_cars(daily_rate);

-- ============================================================
-- Mansions
-- ============================================================
CREATE TABLE IF NOT EXISTS mansions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_provider TEXT NOT NULL DEFAULT 'mvpmiami',
  source_listing_id TEXT NOT NULL,
  source_url TEXT,
  name TEXT NOT NULL,
  location TEXT,
  city TEXT DEFAULT 'Miami',
  region TEXT DEFAULT 'FL',
  bedrooms INTEGER,
  bathrooms NUMERIC(3,1),
  capacity INTEGER,
  bed_config TEXT,
  nightly_rate INTEGER,
  description TEXT,
  amenities TEXT[] DEFAULT '{}',
  photo_urls TEXT[] DEFAULT '{}',
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  scrape_status TEXT DEFAULT 'pending',
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_provider, source_listing_id)
);

CREATE INDEX IF NOT EXISTS idx_mansions_city ON mansions(city);
CREATE INDEX IF NOT EXISTS idx_mansions_active ON mansions(is_active);

-- ============================================================
-- MVP Yachts (separate from Boatsetter boats table)
-- ============================================================
CREATE TABLE IF NOT EXISTS mvp_yachts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_provider TEXT NOT NULL DEFAULT 'mvpmiami',
  source_listing_id TEXT NOT NULL,
  source_url TEXT,
  name TEXT NOT NULL,
  builder TEXT,
  length_meters NUMERIC(6,2),
  length_feet INTEGER,
  top_speed_knots INTEGER,
  staterooms INTEGER,
  sleeping_capacity INTEGER,
  cruising_capacity INTEGER,
  description TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  city TEXT DEFAULT 'Miami',
  region TEXT DEFAULT 'FL',
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  scrape_status TEXT DEFAULT 'pending',
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_provider, source_listing_id)
);

CREATE INDEX IF NOT EXISTS idx_mvp_yachts_active ON mvp_yachts(is_active);
