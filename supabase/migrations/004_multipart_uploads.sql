-- Multipart upload state tracking for resumable uploads
-- Stores S3 multipart upload state for recovery after server restarts

CREATE TABLE IF NOT EXISTS multipart_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- S3/Filebase identifiers
  upload_id TEXT NOT NULL,
  s3_key TEXT NOT NULL,

  -- User info
  creator_wallet TEXT NOT NULL,

  -- File metadata
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  content_type TEXT,
  chunk_size INTEGER NOT NULL DEFAULT 5242880, -- 5MB default
  total_parts INTEGER NOT NULL,

  -- Upload options
  encrypt BOOLEAN NOT NULL DEFAULT false,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'aborted', 'expired')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Indexes for lookups
  UNIQUE(upload_id)
);

-- Uploaded parts tracking
CREATE TABLE IF NOT EXISTS multipart_upload_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id TEXT NOT NULL REFERENCES multipart_uploads(upload_id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL,
  etag TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(upload_id, part_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_multipart_uploads_wallet ON multipart_uploads(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_multipart_uploads_status ON multipart_uploads(status);
CREATE INDEX IF NOT EXISTS idx_multipart_uploads_expires ON multipart_uploads(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_multipart_upload_parts_upload ON multipart_upload_parts(upload_id);

-- Row Level Security
ALTER TABLE multipart_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE multipart_upload_parts ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see/manage their own uploads
-- Uses public.get_wallet_address() function defined in 001_content_drafts.sql
CREATE POLICY "Users can view own uploads"
  ON multipart_uploads FOR SELECT
  USING (creator_wallet = public.get_wallet_address());

CREATE POLICY "Users can create uploads"
  ON multipart_uploads FOR INSERT
  WITH CHECK (creator_wallet = public.get_wallet_address());

CREATE POLICY "Users can update own uploads"
  ON multipart_uploads FOR UPDATE
  USING (creator_wallet = public.get_wallet_address());

CREATE POLICY "Users can delete own uploads"
  ON multipart_uploads FOR DELETE
  USING (creator_wallet = public.get_wallet_address());

-- Parts policies (inherit from parent upload)
CREATE POLICY "Users can view own upload parts"
  ON multipart_upload_parts FOR SELECT
  USING (
    upload_id IN (
      SELECT upload_id FROM multipart_uploads
      WHERE creator_wallet = public.get_wallet_address()
    )
  );

CREATE POLICY "Users can create upload parts"
  ON multipart_upload_parts FOR INSERT
  WITH CHECK (
    upload_id IN (
      SELECT upload_id FROM multipart_uploads
      WHERE creator_wallet = public.get_wallet_address()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_multipart_upload_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER multipart_uploads_updated_at
  BEFORE UPDATE ON multipart_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_multipart_upload_timestamp();

-- Function to clean up expired uploads (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_multipart_uploads()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM multipart_uploads
    WHERE status = 'active' AND expires_at < NOW()
    RETURNING 1
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
