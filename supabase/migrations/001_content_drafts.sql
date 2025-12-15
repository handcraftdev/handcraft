-- Drafts table for work-in-progress content
CREATE TABLE content_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_wallet TEXT NOT NULL,

  -- Content identification
  content_type INTEGER NOT NULL,        -- ContentType enum value
  domain TEXT NOT NULL,                 -- video/audio/image/document/file/text

  -- Upload state
  status TEXT NOT NULL DEFAULT 'draft', -- draft | uploading | scheduled | published | failed

  -- File references (after upload to IPFS)
  content_cid TEXT,
  preview_cid TEXT,
  thumbnail_cid TEXT,
  metadata_cid TEXT,
  encryption_meta_cid TEXT,

  -- Metadata (JSON - type-specific fields)
  title TEXT,
  description TEXT,
  tags TEXT[],
  type_metadata JSONB,                  -- Type-specific fields (artist, director, etc.)

  -- Monetization config
  mint_price BIGINT,                    -- In lamports
  supply_limit INTEGER,
  visibility_level INTEGER DEFAULT 0,
  rental_config JSONB,                  -- {6h: price, 1d: price, 7d: price}

  -- Scheduling
  scheduled_at TIMESTAMPTZ,             -- NULL = immediate publish
  published_at TIMESTAMPTZ,

  -- On-chain reference (after publish)
  content_pda TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_drafts_creator ON content_drafts(creator_wallet);
CREATE INDEX idx_drafts_status ON content_drafts(status);
CREATE INDEX idx_drafts_scheduled ON content_drafts(scheduled_at) WHERE status = 'scheduled';

-- Scheduled publish job tracking
CREATE TABLE publish_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES content_drafts(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',        -- pending | processing | completed | failed
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE content_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE publish_jobs ENABLE ROW LEVEL SECURITY;

-- Helper function to get authenticated wallet address from JWT
-- Web3 auth stores wallet address in identity_data
-- Note: Created in public schema since auth schema is protected
CREATE OR REPLACE FUNCTION public.get_wallet_address()
RETURNS TEXT AS $$
  SELECT COALESCE(
    -- Try to get from JWT claims (Web3 auth stores wallet in sub or identity_data)
    auth.jwt() ->> 'wallet_address',
    -- Fallback: check raw_user_meta_data
    (auth.jwt() -> 'user_metadata' ->> 'wallet_address'),
    -- Fallback: use sub claim directly (for Web3 auth, this might be the wallet)
    auth.jwt() ->> 'sub'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- RLS Policies for content_drafts
-- Allow users to view their own drafts
CREATE POLICY "Users can view their own drafts"
  ON content_drafts FOR SELECT
  USING (creator_wallet = public.get_wallet_address());

-- Allow users to insert their own drafts
CREATE POLICY "Users can insert their own drafts"
  ON content_drafts FOR INSERT
  WITH CHECK (creator_wallet = public.get_wallet_address());

-- Allow users to update their own drafts
CREATE POLICY "Users can update their own drafts"
  ON content_drafts FOR UPDATE
  USING (creator_wallet = public.get_wallet_address());

-- Allow users to delete their own drafts
CREATE POLICY "Users can delete their own drafts"
  ON content_drafts FOR DELETE
  USING (creator_wallet = public.get_wallet_address());

-- RLS Policies for publish_jobs
-- Allow users to view jobs for their drafts
CREATE POLICY "Users can view jobs for their drafts"
  ON publish_jobs FOR SELECT
  USING (
    draft_id IN (
      SELECT id FROM content_drafts
      WHERE creator_wallet = public.get_wallet_address()
    )
  );
