-- ============================================================================
-- Reward Accounting System - Transaction Ledger & Analytics
-- ============================================================================
-- This migration creates the database schema for tracking all reward-related
-- transactions from on-chain events emitted by the Solana program.
--
-- Key Features:
-- - Complete transaction history with event sourcing pattern
-- - Aggregated views for creator revenue and user earnings
-- - Pool snapshots for historical analytics
-- - Optimized indexes for common query patterns
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Transaction types matching on-chain events
CREATE TYPE transaction_type AS ENUM (
  'mint',                    -- NFT minted (primary sale)
  'patron_subscription',     -- Creator patron subscription payment
  'ecosystem_subscription',  -- Platform ecosystem subscription payment
  'secondary_royalty',       -- Secondary sale royalty
  'reward_claim',            -- User claimed rewards
  'reward_distribution',     -- Epoch-based lazy distribution
  'reward_transfer'          -- NFT transfer causing reward debt transfer
);

-- Pool types matching on-chain pools
CREATE TYPE pool_type AS ENUM (
  'content',          -- ContentRewardPool (immediate)
  'bundle',           -- BundleRewardPool (immediate)
  'creator_patron',   -- CreatorPatronPool (lazy)
  'global_holder',    -- GlobalHolderPool (lazy)
  'creator_dist'      -- CreatorDistPool (lazy)
);

-- Subscription types
CREATE TYPE subscription_type AS ENUM (
  'patron_membership',     -- Support-only tier (no content access)
  'patron_subscription',   -- Support + Level 2 content access
  'ecosystem'              -- Platform-wide access
);

-- ============================================================================
-- MAIN TRANSACTION LEDGER
-- ============================================================================

-- Core ledger table - immutable event log of all reward transactions
CREATE TABLE reward_transactions (
  id BIGSERIAL PRIMARY KEY,

  -- Transaction identity
  signature TEXT NOT NULL,                -- Solana transaction signature
  block_time TIMESTAMPTZ NOT NULL,        -- Block timestamp
  slot BIGINT NOT NULL,                   -- Solana slot number
  transaction_type transaction_type NOT NULL,

  -- Pool information
  pool_type pool_type,                    -- Which pool was affected (NULL for complex distributions)
  pool_id TEXT,                           -- Pool identifier pubkey (content/bundle/creator, or NULL for global)

  -- Amounts in lamports
  amount BIGINT NOT NULL,                 -- Primary amount (deposit, claim, transfer)

  -- Fee splits (for primary sales/subscriptions)
  creator_share BIGINT,                   -- Amount to creator
  platform_share BIGINT,                  -- Amount to platform treasury
  ecosystem_share BIGINT,                 -- Amount to ecosystem treasury
  holder_share BIGINT,                    -- Amount to holder reward pool

  -- Distribution specifics (for lazy distribution events)
  creator_dist_pool_amount BIGINT,        -- Amount to creator distribution pool (ecosystem only)

  -- Participants
  source_wallet TEXT NOT NULL,            -- Initiator (buyer, subscriber, claimer)
  creator_wallet TEXT,                    -- Creator involved (if applicable)
  receiver_wallet TEXT,                   -- Receiver (for transfers)

  -- Content/NFT references
  content_pubkey TEXT,                    -- Content or bundle pubkey
  nft_asset TEXT,                         -- NFT asset pubkey (for holder claims/transfers)
  nft_weight SMALLINT,                    -- NFT rarity weight (if applicable)

  -- Subscription references
  stream_id TEXT,                         -- Streamflow stream ID (for subscriptions)
  subscription_type subscription_type,    -- Type of subscription

  -- State tracking
  reward_per_share NUMERIC(39, 0),        -- Pool's reward_per_share after transaction (u128)
  debt_before NUMERIC(39, 0),             -- Reward debt before claim (u128)
  debt_after NUMERIC(39, 0),              -- Reward debt after claim (u128)

  -- Metadata
  event_data JSONB,                       -- Full event data for debugging
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_signature_type UNIQUE (signature, transaction_type, source_wallet)
);

-- ============================================================================
-- CREATOR REVENUE AGGREGATION
-- ============================================================================

-- Aggregated view of creator earnings across all revenue streams
CREATE TABLE creator_revenue (
  id BIGSERIAL PRIMARY KEY,
  creator_wallet TEXT NOT NULL UNIQUE,

  -- Primary sales (80% of mint price)
  total_primary_sales BIGINT NOT NULL DEFAULT 0,
  primary_sales_count BIGINT NOT NULL DEFAULT 0,

  -- Patron subscriptions (80% of patron fees after distribution)
  total_patron_revenue BIGINT NOT NULL DEFAULT 0,
  patron_subscriber_count BIGINT NOT NULL DEFAULT 0,
  active_patron_subscribers BIGINT NOT NULL DEFAULT 0,

  -- Ecosystem creator payouts (from CreatorDistPool)
  total_ecosystem_payouts BIGINT NOT NULL DEFAULT 0,
  ecosystem_payout_claims BIGINT NOT NULL DEFAULT 0,

  -- Secondary royalties (4% of secondary sales)
  total_secondary_royalties BIGINT NOT NULL DEFAULT 0,
  secondary_sale_count BIGINT NOT NULL DEFAULT 0,

  -- Computed totals
  total_all_time_revenue BIGINT NOT NULL DEFAULT 0,

  -- Timestamps
  first_revenue_at TIMESTAMPTZ,
  last_revenue_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- USER EARNINGS AGGREGATION
-- ============================================================================

-- Aggregated view of user earnings as NFT holders
CREATE TABLE user_earnings (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL UNIQUE,

  -- Content pool claims (immediate rewards)
  total_content_rewards BIGINT NOT NULL DEFAULT 0,
  content_claim_count BIGINT NOT NULL DEFAULT 0,

  -- Bundle pool claims (immediate rewards)
  total_bundle_rewards BIGINT NOT NULL DEFAULT 0,
  bundle_claim_count BIGINT NOT NULL DEFAULT 0,

  -- Creator patron pool claims (lazy rewards)
  total_patron_rewards BIGINT NOT NULL DEFAULT 0,
  patron_claim_count BIGINT NOT NULL DEFAULT 0,

  -- Global holder pool claims (lazy rewards)
  total_global_rewards BIGINT NOT NULL DEFAULT 0,
  global_claim_count BIGINT NOT NULL DEFAULT 0,

  -- Computed totals
  total_all_time_earnings BIGINT NOT NULL DEFAULT 0,
  total_claim_count BIGINT NOT NULL DEFAULT 0,

  -- Timestamps
  first_claim_at TIMESTAMPTZ,
  last_claim_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- POOL SNAPSHOTS (for historical analytics)
-- ============================================================================

-- Time-series data of pool states for charting
CREATE TABLE pool_snapshots (
  id BIGSERIAL PRIMARY KEY,

  -- Pool identity
  pool_type pool_type NOT NULL,
  pool_id TEXT,                           -- NULL for global pools

  -- Pool state at snapshot time
  reward_per_share NUMERIC(39, 0) NOT NULL,
  total_weight BIGINT NOT NULL,
  total_deposited BIGINT NOT NULL,
  total_claimed BIGINT NOT NULL,
  unclaimed_balance BIGINT NOT NULL,      -- total_deposited - total_claimed

  -- For lazy pools
  streaming_treasury_balance BIGINT,      -- Undistributed funds in treasury
  last_distribution_at TIMESTAMPTZ,
  epoch_duration INTEGER,                 -- Seconds

  -- Snapshot metadata
  snapshot_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL,               -- 'webhook', 'cron', 'manual'

  CONSTRAINT unique_pool_snapshot UNIQUE (pool_type, pool_id, snapshot_at)
);

-- ============================================================================
-- SUBSCRIPTION TRACKING
-- ============================================================================

-- Active and historical subscriptions
CREATE TABLE subscriptions (
  id BIGSERIAL PRIMARY KEY,

  -- Subscription identity
  subscriber_wallet TEXT NOT NULL,
  creator_wallet TEXT,                    -- NULL for ecosystem subscriptions
  subscription_type subscription_type NOT NULL,

  -- Streamflow integration
  stream_id TEXT NOT NULL UNIQUE,
  monthly_price BIGINT NOT NULL,          -- Lamports per month

  -- State
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  started_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  renewed_at TIMESTAMPTZ,

  -- Transaction references
  created_signature TEXT NOT NULL,        -- Transaction that created subscription
  cancelled_signature TEXT,               -- Transaction that cancelled subscription

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index to ensure only one active subscription per subscriber/creator/type combination
CREATE UNIQUE INDEX unique_active_subscription
  ON subscriptions (subscriber_wallet, creator_wallet, subscription_type)
  WHERE is_active = TRUE;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Transaction ledger indexes
CREATE INDEX idx_reward_txs_signature ON reward_transactions(signature);
CREATE INDEX idx_reward_txs_block_time ON reward_transactions(block_time DESC);
CREATE INDEX idx_reward_txs_source_wallet ON reward_transactions(source_wallet, block_time DESC);
CREATE INDEX idx_reward_txs_creator_wallet ON reward_transactions(creator_wallet, block_time DESC) WHERE creator_wallet IS NOT NULL;
CREATE INDEX idx_reward_txs_type ON reward_transactions(transaction_type, block_time DESC);
CREATE INDEX idx_reward_txs_pool ON reward_transactions(pool_type, pool_id, block_time DESC) WHERE pool_type IS NOT NULL;
CREATE INDEX idx_reward_txs_content ON reward_transactions(content_pubkey, block_time DESC) WHERE content_pubkey IS NOT NULL;
CREATE INDEX idx_reward_txs_nft ON reward_transactions(nft_asset) WHERE nft_asset IS NOT NULL;

-- Creator revenue indexes
CREATE INDEX idx_creator_revenue_wallet ON creator_revenue(creator_wallet);
CREATE INDEX idx_creator_revenue_total ON creator_revenue(total_all_time_revenue DESC);
CREATE INDEX idx_creator_revenue_updated ON creator_revenue(updated_at DESC);

-- User earnings indexes
CREATE INDEX idx_user_earnings_wallet ON user_earnings(wallet);
CREATE INDEX idx_user_earnings_total ON user_earnings(total_all_time_earnings DESC);
CREATE INDEX idx_user_earnings_updated ON user_earnings(updated_at DESC);

-- Pool snapshots indexes
CREATE INDEX idx_pool_snapshots_pool ON pool_snapshots(pool_type, pool_id, snapshot_at DESC);
CREATE INDEX idx_pool_snapshots_time ON pool_snapshots(snapshot_at DESC);

-- Subscription indexes
CREATE INDEX idx_subscriptions_subscriber ON subscriptions(subscriber_wallet, is_active);
CREATE INDEX idx_subscriptions_creator ON subscriptions(creator_wallet, is_active) WHERE creator_wallet IS NOT NULL;
CREATE INDEX idx_subscriptions_stream ON subscriptions(stream_id);
CREATE INDEX idx_subscriptions_type ON subscriptions(subscription_type, is_active);
CREATE INDEX idx_subscriptions_active ON subscriptions(is_active, started_at DESC);

-- ============================================================================
-- FUNCTIONS FOR AGGREGATION UPDATES
-- ============================================================================

-- Update creator revenue aggregations
CREATE OR REPLACE FUNCTION update_creator_revenue()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update creator revenue
  INSERT INTO creator_revenue (creator_wallet, first_revenue_at, last_revenue_at, updated_at)
  VALUES (NEW.creator_wallet, NEW.block_time, NEW.block_time, NOW())
  ON CONFLICT (creator_wallet) DO UPDATE SET
    last_revenue_at = GREATEST(creator_revenue.last_revenue_at, NEW.block_time),
    updated_at = NOW();

  -- Update specific revenue type
  CASE NEW.transaction_type
    WHEN 'mint' THEN
      UPDATE creator_revenue SET
        total_primary_sales = total_primary_sales + COALESCE(NEW.creator_share, 0),
        primary_sales_count = primary_sales_count + 1,
        total_all_time_revenue = total_all_time_revenue + COALESCE(NEW.creator_share, 0)
      WHERE creator_wallet = NEW.creator_wallet;

    WHEN 'secondary_royalty' THEN
      UPDATE creator_revenue SET
        total_secondary_royalties = total_secondary_royalties + COALESCE(NEW.creator_share, 0),
        secondary_sale_count = secondary_sale_count + 1,
        total_all_time_revenue = total_all_time_revenue + COALESCE(NEW.creator_share, 0)
      WHERE creator_wallet = NEW.creator_wallet;

    WHEN 'reward_claim' THEN
      -- Creator claiming from CreatorDistPool
      IF NEW.pool_type = 'creator_dist' THEN
        UPDATE creator_revenue SET
          total_ecosystem_payouts = total_ecosystem_payouts + NEW.amount,
          ecosystem_payout_claims = ecosystem_payout_claims + 1,
          total_all_time_revenue = total_all_time_revenue + NEW.amount
        WHERE creator_wallet = NEW.source_wallet;
      END IF;

    WHEN 'reward_distribution' THEN
      -- Patron pool distribution to creator
      IF NEW.pool_type = 'creator_patron' AND NEW.creator_share IS NOT NULL THEN
        UPDATE creator_revenue SET
          total_patron_revenue = total_patron_revenue + NEW.creator_share,
          total_all_time_revenue = total_all_time_revenue + NEW.creator_share
        WHERE creator_wallet = NEW.creator_wallet;
      END IF;

    ELSE
      -- No revenue update for other types
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update user earnings aggregations
CREATE OR REPLACE FUNCTION update_user_earnings()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process claim events
  IF NEW.transaction_type != 'reward_claim' THEN
    RETURN NEW;
  END IF;

  -- Insert or update user earnings
  INSERT INTO user_earnings (wallet, first_claim_at, last_claim_at, updated_at)
  VALUES (NEW.source_wallet, NEW.block_time, NEW.block_time, NOW())
  ON CONFLICT (wallet) DO UPDATE SET
    last_claim_at = GREATEST(user_earnings.last_claim_at, NEW.block_time),
    updated_at = NOW();

  -- Update specific pool type earnings
  CASE NEW.pool_type
    WHEN 'content' THEN
      UPDATE user_earnings SET
        total_content_rewards = total_content_rewards + NEW.amount,
        content_claim_count = content_claim_count + 1,
        total_all_time_earnings = total_all_time_earnings + NEW.amount,
        total_claim_count = total_claim_count + 1
      WHERE wallet = NEW.source_wallet;

    WHEN 'bundle' THEN
      UPDATE user_earnings SET
        total_bundle_rewards = total_bundle_rewards + NEW.amount,
        bundle_claim_count = bundle_claim_count + 1,
        total_all_time_earnings = total_all_time_earnings + NEW.amount,
        total_claim_count = total_claim_count + 1
      WHERE wallet = NEW.source_wallet;

    WHEN 'creator_patron' THEN
      UPDATE user_earnings SET
        total_patron_rewards = total_patron_rewards + NEW.amount,
        patron_claim_count = patron_claim_count + 1,
        total_all_time_earnings = total_all_time_earnings + NEW.amount,
        total_claim_count = total_claim_count + 1
      WHERE wallet = NEW.source_wallet;

    WHEN 'global_holder' THEN
      UPDATE user_earnings SET
        total_global_rewards = total_global_rewards + NEW.amount,
        global_claim_count = global_claim_count + 1,
        total_all_time_earnings = total_all_time_earnings + NEW.amount,
        total_claim_count = total_claim_count + 1
      WHERE wallet = NEW.source_wallet;

    ELSE
      -- No update for other pool types
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update subscription counts for creator revenue
CREATE OR REPLACE FUNCTION update_creator_subscription_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for patron subscriptions (not ecosystem)
  IF NEW.creator_wallet IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ensure creator revenue record exists
  INSERT INTO creator_revenue (creator_wallet, updated_at)
  VALUES (NEW.creator_wallet, NOW())
  ON CONFLICT (creator_wallet) DO NOTHING;

  -- Update counts
  IF TG_OP = 'INSERT' THEN
    UPDATE creator_revenue SET
      patron_subscriber_count = patron_subscriber_count + 1,
      active_patron_subscribers = active_patron_subscribers + CASE WHEN NEW.is_active THEN 1 ELSE 0 END,
      updated_at = NOW()
    WHERE creator_wallet = NEW.creator_wallet;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle activation/deactivation
    IF OLD.is_active != NEW.is_active THEN
      UPDATE creator_revenue SET
        active_patron_subscribers = active_patron_subscribers + CASE WHEN NEW.is_active THEN 1 ELSE -1 END,
        updated_at = NOW()
      WHERE creator_wallet = NEW.creator_wallet;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update creator revenue on transaction insert
CREATE TRIGGER trigger_update_creator_revenue
  AFTER INSERT ON reward_transactions
  FOR EACH ROW
  WHEN (NEW.creator_wallet IS NOT NULL)
  EXECUTE FUNCTION update_creator_revenue();

-- Trigger to update user earnings on claim transaction insert
CREATE TRIGGER trigger_update_user_earnings
  AFTER INSERT ON reward_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_earnings();

-- Trigger to update creator subscription counts
CREATE TRIGGER trigger_update_creator_subscription_counts
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_creator_subscription_counts();

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- Top creators by all-time revenue
CREATE VIEW top_creators_by_revenue AS
SELECT
  creator_wallet,
  total_all_time_revenue,
  total_primary_sales,
  total_patron_revenue,
  total_ecosystem_payouts,
  total_secondary_royalties,
  primary_sales_count,
  active_patron_subscribers,
  last_revenue_at
FROM creator_revenue
ORDER BY total_all_time_revenue DESC;

-- Top earners by holder rewards
CREATE VIEW top_earners_by_rewards AS
SELECT
  wallet,
  total_all_time_earnings,
  total_content_rewards,
  total_bundle_rewards,
  total_patron_rewards,
  total_global_rewards,
  total_claim_count,
  last_claim_at
FROM user_earnings
ORDER BY total_all_time_earnings DESC;

-- Recent transactions (last 1000)
CREATE VIEW recent_transactions AS
SELECT
  id,
  signature,
  block_time,
  transaction_type,
  pool_type,
  amount,
  source_wallet,
  creator_wallet,
  content_pubkey,
  nft_asset
FROM reward_transactions
ORDER BY block_time DESC
LIMIT 1000;

-- Active subscriptions with revenue potential
CREATE VIEW active_subscriptions_summary AS
SELECT
  subscription_type,
  COUNT(*) as subscriber_count,
  SUM(monthly_price) as monthly_revenue_lamports,
  AVG(monthly_price) as avg_price_lamports,
  MIN(started_at) as oldest_subscription,
  MAX(started_at) as newest_subscription
FROM subscriptions
WHERE is_active = TRUE
GROUP BY subscription_type;

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Get revenue breakdown for a creator
CREATE OR REPLACE FUNCTION get_creator_revenue_breakdown(creator TEXT)
RETURNS TABLE (
  source TEXT,
  amount BIGINT,
  percentage NUMERIC
) AS $$
DECLARE
  total BIGINT;
BEGIN
  SELECT total_all_time_revenue INTO total
  FROM creator_revenue
  WHERE creator_wallet = creator;

  IF total IS NULL OR total = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 'Primary Sales'::TEXT,
         cr.total_primary_sales,
         ROUND((cr.total_primary_sales::NUMERIC / total * 100), 2)
  FROM creator_revenue cr WHERE cr.creator_wallet = creator
  UNION ALL
  SELECT 'Patron Revenue'::TEXT,
         cr.total_patron_revenue,
         ROUND((cr.total_patron_revenue::NUMERIC / total * 100), 2)
  FROM creator_revenue cr WHERE cr.creator_wallet = creator
  UNION ALL
  SELECT 'Ecosystem Payouts'::TEXT,
         cr.total_ecosystem_payouts,
         ROUND((cr.total_ecosystem_payouts::NUMERIC / total * 100), 2)
  FROM creator_revenue cr WHERE cr.creator_wallet = creator
  UNION ALL
  SELECT 'Secondary Royalties'::TEXT,
         cr.total_secondary_royalties,
         ROUND((cr.total_secondary_royalties::NUMERIC / total * 100), 2)
  FROM creator_revenue cr WHERE cr.creator_wallet = creator;
END;
$$ LANGUAGE plpgsql;

-- Get earnings breakdown for a user
CREATE OR REPLACE FUNCTION get_user_earnings_breakdown(user_wallet TEXT)
RETURNS TABLE (
  pool TEXT,
  amount BIGINT,
  claim_count BIGINT,
  percentage NUMERIC
) AS $$
DECLARE
  total BIGINT;
BEGIN
  SELECT total_all_time_earnings INTO total
  FROM user_earnings
  WHERE wallet = user_wallet;

  IF total IS NULL OR total = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 'Content Pools'::TEXT,
         ue.total_content_rewards,
         ue.content_claim_count,
         ROUND((ue.total_content_rewards::NUMERIC / total * 100), 2)
  FROM user_earnings ue WHERE ue.wallet = user_wallet
  UNION ALL
  SELECT 'Bundle Pools'::TEXT,
         ue.total_bundle_rewards,
         ue.bundle_claim_count,
         ROUND((ue.total_bundle_rewards::NUMERIC / total * 100), 2)
  FROM user_earnings ue WHERE ue.wallet = user_wallet
  UNION ALL
  SELECT 'Patron Pools'::TEXT,
         ue.total_patron_rewards,
         ue.patron_claim_count,
         ROUND((ue.total_patron_rewards::NUMERIC / total * 100), 2)
  FROM user_earnings ue WHERE ue.wallet = user_wallet
  UNION ALL
  SELECT 'Global Holder Pool'::TEXT,
         ue.total_global_rewards,
         ue.global_claim_count,
         ROUND((ue.total_global_rewards::NUMERIC / total * 100), 2)
  FROM user_earnings ue WHERE ue.wallet = user_wallet;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE reward_transactions IS 'Immutable event log of all reward-related transactions from on-chain events';
COMMENT ON TABLE creator_revenue IS 'Aggregated creator earnings across all revenue streams';
COMMENT ON TABLE user_earnings IS 'Aggregated user earnings as NFT holder from all reward pools';
COMMENT ON TABLE pool_snapshots IS 'Time-series snapshots of pool states for historical analytics';
COMMENT ON TABLE subscriptions IS 'Active and historical subscription records';

COMMENT ON FUNCTION update_creator_revenue() IS 'Trigger function to update creator revenue aggregations on transaction insert';
COMMENT ON FUNCTION update_user_earnings() IS 'Trigger function to update user earnings aggregations on claim transaction insert';
COMMENT ON FUNCTION get_creator_revenue_breakdown(TEXT) IS 'Get revenue breakdown by source for a creator';
COMMENT ON FUNCTION get_user_earnings_breakdown(TEXT) IS 'Get earnings breakdown by pool type for a user';
