-- Migration: Create earthquake_events table
-- Created: 2025-11-01
-- Description: Initial schema for storing PHIVOLCS earthquake data
-- Following backend-developer.md: Database schema design with proper indexing

-- Create earthquake_events table
CREATE TABLE IF NOT EXISTS public.earthquake_events (
    id BIGSERIAL PRIMARY KEY,
    datetime TIMESTAMPTZ NOT NULL,
    latitude DECIMAL(9, 6) NOT NULL,
    longitude DECIMAL(9, 6) NOT NULL,
    depth DECIMAL(6, 2),
    magnitude DECIMAL(3, 1) NOT NULL,
    location TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicate events
    UNIQUE(datetime, latitude, longitude, magnitude)
);

-- Create indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_earthquake_events_datetime 
ON public.earthquake_events(datetime DESC);

CREATE INDEX IF NOT EXISTS idx_earthquake_events_location 
ON public.earthquake_events USING GIN(to_tsvector('english', location));

CREATE INDEX IF NOT EXISTS idx_earthquake_events_magnitude 
ON public.earthquake_events(magnitude DESC);

-- Enable Row Level Security
ALTER TABLE public.earthquake_events ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access (anon key)
CREATE POLICY "Allow public read access" 
ON public.earthquake_events 
FOR SELECT 
TO anon 
USING (true);

-- Policy: Allow service role write access
CREATE POLICY "Allow service role write access" 
ON public.earthquake_events 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_earthquake_events_updated_at 
    BEFORE UPDATE ON public.earthquake_events 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add table comment
COMMENT ON TABLE public.earthquake_events IS 'Stores earthquake event data scraped from PHIVOLCS';
