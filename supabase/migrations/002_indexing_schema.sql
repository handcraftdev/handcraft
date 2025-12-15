-- Content Indexing Schema for Helius Webhook Integration
-- This schema stores indexed on-chain data for fast querying and search

-- ========== INDEXED CONTENT ==========
-- Stores indexed content entries with metadata
CREATE TABLE IF NOT EXISTS indexed_content (
    id BIGSERIAL PRIMARY KEY,

    -- On-chain identifiers
    content_address TEXT NOT NULL UNIQUE, -- PDA address
    content_cid TEXT NOT NULL UNIQUE,     -- IPFS CID
    metadata_cid TEXT NOT NULL,            -- Metadata IPFS CID
    creator_address TEXT NOT NULL,         -- Creator wallet address

    -- Content metadata (from IPFS)
    name TEXT,
    description TEXT,
    image_url TEXT,
    animation_url TEXT,

    -- Content type and domain
    content_type SMALLINT NOT NULL,        -- ContentType enum (0-16)
    content_domain TEXT NOT NULL,          -- video, audio, image, document, file, text

    -- Visibility and encryption
    visibility_level SMALLINT NOT NULL DEFAULT 0,  -- 0=Public, 1=Ecosystem, 2=Subscriber, 3=NftOnly
    is_encrypted BOOLEAN NOT NULL DEFAULT false,
    preview_cid TEXT,
    encryption_meta_cid TEXT,

    -- Status and stats
    is_locked BOOLEAN NOT NULL DEFAULT false,
    minted_count BIGINT NOT NULL DEFAULT 0,
    pending_count BIGINT NOT NULL DEFAULT 0,
    tips_received BIGINT NOT NULL DEFAULT 0,

    -- Discovery metadata
    tags TEXT[] DEFAULT '{}',
    category TEXT,
    genre TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Search vector for full-text search
    search_vector TSVECTOR
);

-- Indexes for indexed_content
CREATE INDEX IF NOT EXISTS idx_content_creator ON indexed_content(creator_address);
CREATE INDEX IF NOT EXISTS idx_content_type ON indexed_content(content_type);
CREATE INDEX IF NOT EXISTS idx_content_domain ON indexed_content(content_domain);
CREATE INDEX IF NOT EXISTS idx_content_visibility ON indexed_content(visibility_level);
CREATE INDEX IF NOT EXISTS idx_content_created ON indexed_content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_minted ON indexed_content(minted_count DESC);
CREATE INDEX IF NOT EXISTS idx_content_tags ON indexed_content USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_content_category ON indexed_content(category);
CREATE INDEX IF NOT EXISTS idx_content_search ON indexed_content USING GIN(search_vector);

-- Trigger to automatically update search_vector
CREATE OR REPLACE FUNCTION update_content_search_vector() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.genre, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_search_vector_update
    BEFORE INSERT OR UPDATE ON indexed_content
    FOR EACH ROW
    EXECUTE FUNCTION update_content_search_vector();

-- ========== INDEXED BUNDLES ==========
-- Stores indexed bundle entries with metadata
CREATE TABLE IF NOT EXISTS indexed_bundles (
    id BIGSERIAL PRIMARY KEY,

    -- On-chain identifiers
    bundle_address TEXT NOT NULL UNIQUE,   -- PDA address
    bundle_id TEXT NOT NULL,               -- Bundle ID (CID or slug)
    metadata_cid TEXT NOT NULL,            -- Metadata IPFS CID
    creator_address TEXT NOT NULL,         -- Creator wallet address

    -- Bundle metadata (from IPFS)
    name TEXT,
    description TEXT,
    image_url TEXT,

    -- Bundle type
    bundle_type SMALLINT NOT NULL,         -- BundleType enum (0-6)
    bundle_type_label TEXT NOT NULL,       -- "album", "series", "course", etc.

    -- Bundle info
    item_count INTEGER NOT NULL DEFAULT 0,

    -- Status and stats
    is_locked BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    minted_count BIGINT NOT NULL DEFAULT 0,
    pending_count BIGINT NOT NULL DEFAULT 0,

    -- Type-specific metadata
    artist TEXT,
    show_name TEXT,
    instructor TEXT,
    season_number INTEGER,
    total_seasons INTEGER,

    -- Discovery metadata
    tags TEXT[] DEFAULT '{}',
    category TEXT,
    genre TEXT,
    year TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Search vector for full-text search
    search_vector TSVECTOR,

    -- Unique constraint on creator + bundle_id
    CONSTRAINT unique_creator_bundle UNIQUE(creator_address, bundle_id)
);

-- Indexes for indexed_bundles
CREATE INDEX IF NOT EXISTS idx_bundle_creator ON indexed_bundles(creator_address);
CREATE INDEX IF NOT EXISTS idx_bundle_type ON indexed_bundles(bundle_type);
CREATE INDEX IF NOT EXISTS idx_bundle_created ON indexed_bundles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bundle_minted ON indexed_bundles(minted_count DESC);
CREATE INDEX IF NOT EXISTS idx_bundle_tags ON indexed_bundles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_bundle_category ON indexed_bundles(category);
CREATE INDEX IF NOT EXISTS idx_bundle_search ON indexed_bundles USING GIN(search_vector);

-- Trigger to automatically update search_vector for bundles
CREATE OR REPLACE FUNCTION update_bundle_search_vector() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.artist, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.show_name, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.instructor, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.genre, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bundle_search_vector_update
    BEFORE INSERT OR UPDATE ON indexed_bundles
    FOR EACH ROW
    EXECUTE FUNCTION update_bundle_search_vector();

-- ========== BUNDLE CONTENT RELATIONSHIP ==========
-- Links bundles to their content items
CREATE TABLE IF NOT EXISTS bundle_content (
    id BIGSERIAL PRIMARY KEY,

    bundle_id BIGINT NOT NULL REFERENCES indexed_bundles(id) ON DELETE CASCADE,
    content_id BIGINT NOT NULL REFERENCES indexed_content(id) ON DELETE CASCADE,

    -- Position within bundle
    position INTEGER NOT NULL,

    -- Per-item metadata overrides
    custom_title TEXT,
    custom_description TEXT,
    duration INTEGER, -- Duration in seconds (for audio/video)

    -- Timestamps
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint: each content can only appear once per bundle
    CONSTRAINT unique_bundle_content UNIQUE(bundle_id, content_id)
);

-- Indexes for bundle_content
CREATE INDEX IF NOT EXISTS idx_bundle_content_bundle ON bundle_content(bundle_id, position);
CREATE INDEX IF NOT EXISTS idx_bundle_content_content ON bundle_content(content_id);

-- ========== INDEXED CREATORS ==========
-- Stores creator profiles and stats
CREATE TABLE IF NOT EXISTS indexed_creators (
    id BIGSERIAL PRIMARY KEY,

    -- Creator identifier
    creator_address TEXT NOT NULL UNIQUE,

    -- Profile info (from UserProfile account if exists)
    username TEXT,

    -- Stats (aggregated from content)
    total_content_count INTEGER NOT NULL DEFAULT 0,
    total_bundle_count INTEGER NOT NULL DEFAULT 0,
    total_mints BIGINT NOT NULL DEFAULT 0,
    total_tips BIGINT NOT NULL DEFAULT 0,

    -- Timestamps
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for indexed_creators
CREATE INDEX IF NOT EXISTS idx_creator_username ON indexed_creators(username);
CREATE INDEX IF NOT EXISTS idx_creator_activity ON indexed_creators(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_mints ON indexed_creators(total_mints DESC);

-- ========== INDEXED OWNERSHIP ==========
-- Tracks NFT ownership for fast access control checks
CREATE TABLE IF NOT EXISTS indexed_ownership (
    id BIGSERIAL PRIMARY KEY,

    -- NFT identifier
    nft_address TEXT NOT NULL UNIQUE,

    -- Owner
    owner_address TEXT NOT NULL,

    -- What this NFT grants access to
    content_id BIGINT REFERENCES indexed_content(id) ON DELETE SET NULL,
    bundle_id BIGINT REFERENCES indexed_bundles(id) ON DELETE SET NULL,

    -- NFT metadata
    collection_address TEXT,
    name TEXT,

    -- Rarity (if applicable)
    rarity SMALLINT, -- 0=Common, 1=Uncommon, 2=Rare, 3=Epic, 4=Legendary
    weight INTEGER,  -- Rarity weight

    -- Timestamps
    minted_at TIMESTAMPTZ NOT NULL,
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Check constraint: must reference either content or bundle (or both for bundle items)
    CONSTRAINT ownership_reference_check CHECK (content_id IS NOT NULL OR bundle_id IS NOT NULL)
);

-- Indexes for indexed_ownership
CREATE INDEX IF NOT EXISTS idx_ownership_owner ON indexed_ownership(owner_address);
CREATE INDEX IF NOT EXISTS idx_ownership_content ON indexed_ownership(content_id);
CREATE INDEX IF NOT EXISTS idx_ownership_bundle ON indexed_ownership(bundle_id);
CREATE INDEX IF NOT EXISTS idx_ownership_collection ON indexed_ownership(collection_address);
CREATE INDEX IF NOT EXISTS idx_ownership_minted ON indexed_ownership(minted_at DESC);

-- ========== HELPER VIEWS ==========

-- View for trending content (based on recent mints)
CREATE OR REPLACE VIEW trending_content AS
SELECT
    ic.*,
    COUNT(io.id) as recent_mints,
    MAX(io.minted_at) as last_mint_at
FROM indexed_content ic
LEFT JOIN indexed_ownership io ON io.content_id = ic.id
    AND io.minted_at > NOW() - INTERVAL '7 days'
WHERE ic.visibility_level = 0 OR ic.visibility_level = 1  -- Only show public/ecosystem content
GROUP BY ic.id
HAVING COUNT(io.id) > 0
ORDER BY recent_mints DESC, last_mint_at DESC
LIMIT 100;

-- View for trending bundles (based on recent mints)
CREATE OR REPLACE VIEW trending_bundles AS
SELECT
    ib.*,
    COUNT(io.id) as recent_mints,
    MAX(io.minted_at) as last_mint_at
FROM indexed_bundles ib
LEFT JOIN indexed_ownership io ON io.bundle_id = ib.id
    AND io.minted_at > NOW() - INTERVAL '7 days'
WHERE ib.is_active = true
GROUP BY ib.id
HAVING COUNT(io.id) > 0
ORDER BY recent_mints DESC, last_mint_at DESC
LIMIT 100;

-- View for creator leaderboard
CREATE OR REPLACE VIEW creator_leaderboard AS
SELECT
    creator_address,
    username,
    total_content_count,
    total_bundle_count,
    total_mints,
    total_tips,
    last_activity_at
FROM indexed_creators
WHERE total_mints > 0
ORDER BY total_mints DESC
LIMIT 100;

-- ========== FUNCTIONS ==========

-- Function to update creator stats
CREATE OR REPLACE FUNCTION update_creator_stats(p_creator_address TEXT) RETURNS VOID AS $$
BEGIN
    INSERT INTO indexed_creators (creator_address, total_content_count, total_bundle_count, total_mints, total_tips, last_activity_at)
    SELECT
        p_creator_address,
        COUNT(DISTINCT ic.id),
        COUNT(DISTINCT ib.id),
        COALESCE(SUM(ic.minted_count), 0) + COALESCE(SUM(ib.minted_count), 0),
        COALESCE(SUM(ic.tips_received), 0),
        NOW()
    FROM indexed_content ic
    FULL OUTER JOIN indexed_bundles ib ON ic.creator_address = ib.creator_address
    WHERE ic.creator_address = p_creator_address OR ib.creator_address = p_creator_address
    ON CONFLICT (creator_address) DO UPDATE SET
        total_content_count = EXCLUDED.total_content_count,
        total_bundle_count = EXCLUDED.total_bundle_count,
        total_mints = EXCLUDED.total_mints,
        total_tips = EXCLUDED.total_tips,
        last_activity_at = EXCLUDED.last_activity_at,
        indexed_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ========== ROW LEVEL SECURITY (RLS) ==========
-- Enable RLS for all tables (read-only access)
ALTER TABLE indexed_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE indexed_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE indexed_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE indexed_ownership ENABLE ROW LEVEL SECURITY;

-- Allow public read access (indexing is done server-side)
CREATE POLICY "Public read access" ON indexed_content FOR SELECT USING (true);
CREATE POLICY "Public read access" ON indexed_bundles FOR SELECT USING (true);
CREATE POLICY "Public read access" ON bundle_content FOR SELECT USING (true);
CREATE POLICY "Public read access" ON indexed_creators FOR SELECT USING (true);
CREATE POLICY "Public read access" ON indexed_ownership FOR SELECT USING (true);

-- Only service role can write (via server-side API routes)
-- This is handled by Supabase service role key, no additional policies needed
