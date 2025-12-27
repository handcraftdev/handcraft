-- ============================================================================
-- Creator Landing Page Schema
-- ============================================================================
-- Adds tables for creator profile customization, announcements, and featured content

-- ============================================================================
-- CREATOR PROFILE SETTINGS
-- ============================================================================
-- Stores creator customization (banner, bio, tagline)

CREATE TABLE IF NOT EXISTS creator_profile_settings (
    id BIGSERIAL PRIMARY KEY,

    -- Creator identifier (wallet address)
    creator_address TEXT NOT NULL UNIQUE,

    -- Profile customization
    banner_cid TEXT,                    -- IPFS CID for banner image
    banner_url TEXT,                    -- Pre-resolved URL for faster loading
    bio TEXT,                           -- Extended bio (up to 1000 chars)
    tagline TEXT,                       -- Short tagline (up to 150 chars)

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CREATOR SOCIAL LINKS
-- ============================================================================
-- Stores external/social links for creators

CREATE TABLE IF NOT EXISTS creator_social_links (
    id BIGSERIAL PRIMARY KEY,

    -- Creator identifier
    creator_address TEXT NOT NULL,

    -- Link data
    platform TEXT NOT NULL,             -- twitter, discord, youtube, website, etc.
    url TEXT NOT NULL,
    display_name TEXT,                  -- Optional custom display name
    position INTEGER NOT NULL DEFAULT 0,-- Order of display
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint: one link per platform per creator
    CONSTRAINT unique_creator_platform UNIQUE(creator_address, platform)
);

-- ============================================================================
-- CREATOR ANNOUNCEMENTS
-- ============================================================================
-- Stores creator announcements with optional expiry

CREATE TABLE IF NOT EXISTS creator_announcements (
    id BIGSERIAL PRIMARY KEY,

    -- Creator identifier
    creator_address TEXT NOT NULL,

    -- Announcement content
    title TEXT NOT NULL,
    content TEXT NOT NULL,              -- Markdown supported
    link_url TEXT,                      -- Optional external link
    link_text TEXT,                     -- Link button text

    -- Visibility
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Scheduling
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,             -- NULL = never expires

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CREATOR FEATURED CONTENT
-- ============================================================================
-- Stores featured/pinned content for creator's landing page (max 6 items)

CREATE TABLE IF NOT EXISTS creator_featured_content (
    id BIGSERIAL PRIMARY KEY,

    -- Creator identifier
    creator_address TEXT NOT NULL,

    -- Content reference (can be content or bundle)
    content_type TEXT NOT NULL,         -- 'content' or 'bundle'
    content_cid TEXT NOT NULL,          -- Content CID or Bundle ID

    -- Display options
    position INTEGER NOT NULL DEFAULT 0,-- Order of display (0-5, 0 = hero)
    is_hero BOOLEAN NOT NULL DEFAULT false, -- Position 0 = hero display
    custom_title TEXT,                  -- Override display title
    custom_description TEXT,            -- Override display description

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT max_featured_position CHECK (position >= 0 AND position <= 5),
    CONSTRAINT unique_creator_position UNIQUE(creator_address, position),
    CONSTRAINT unique_creator_content UNIQUE(creator_address, content_type, content_cid),
    CONSTRAINT valid_content_type CHECK (content_type IN ('content', 'bundle'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profile_settings_creator
    ON creator_profile_settings(creator_address);

CREATE INDEX IF NOT EXISTS idx_social_links_creator
    ON creator_social_links(creator_address, position);

CREATE INDEX IF NOT EXISTS idx_social_links_active
    ON creator_social_links(creator_address)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_announcements_creator
    ON creator_announcements(creator_address, is_active, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_active
    ON creator_announcements(creator_address, is_active, expires_at)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_featured_creator
    ON creator_featured_content(creator_address, position);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE creator_profile_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_featured_content ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables
CREATE POLICY "Public read access" ON creator_profile_settings
    FOR SELECT USING (true);

CREATE POLICY "Public read access" ON creator_social_links
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read access" ON creator_announcements
    FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

CREATE POLICY "Public read access" ON creator_featured_content
    FOR SELECT USING (true);

-- Service role has full access (for API routes with signature verification)
CREATE POLICY "Service role full access" ON creator_profile_settings
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON creator_social_links
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON creator_announcements
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON creator_featured_content
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get active announcements for a creator
CREATE OR REPLACE FUNCTION get_active_announcements(p_creator_address TEXT)
RETURNS SETOF creator_announcements AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM creator_announcements
    WHERE creator_address = p_creator_address
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY is_pinned DESC, published_at DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update timestamps automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_creator_profile_settings_updated_at
    BEFORE UPDATE ON creator_profile_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_creator_social_links_updated_at
    BEFORE UPDATE ON creator_social_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_creator_announcements_updated_at
    BEFORE UPDATE ON creator_announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_creator_featured_content_updated_at
    BEFORE UPDATE ON creator_featured_content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
