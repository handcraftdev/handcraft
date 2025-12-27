import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors
let _supabase: SupabaseClient | null = null;

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }
  return url;
}

function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }
  return key;
}

// Default anon client (for unauthenticated operations)
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!_supabase) {
      _supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());
    }
    return (_supabase as any)[prop];
  },
});

/**
 * Create a Supabase client authenticated with a user's access token
 * Use this in API routes to respect RLS policies
 */
export function createAuthenticatedClient(accessToken: string): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Extract access token from Authorization header
 */
export function getAccessTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

// Types for content drafts
export interface ContentDraft {
  id: string;
  creator_wallet: string;

  // Content identification
  content_type: number;
  domain: string;

  // Upload state
  status: 'draft' | 'uploading' | 'scheduled' | 'ready_to_publish' | 'published' | 'failed';

  // File references (after upload to IPFS)
  content_cid: string | null;
  preview_cid: string | null;
  thumbnail_cid: string | null;
  metadata_cid: string | null;
  encryption_meta_cid: string | null;

  // Metadata
  title: string | null;
  description: string | null;
  tags: string[] | null;
  type_metadata: Record<string, any> | null;

  // Monetization config
  mint_price: number | null;
  supply_limit: number | null;
  visibility_level: number;
  rental_config: {
    rentFee6h?: number;
    rentFee1d?: number;
    rentFee7d?: number;
  } | null;

  // Scheduling
  scheduled_at: string | null;
  published_at: string | null;

  // On-chain reference
  content_pda: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface PublishJob {
  id: string;
  draft_id: string;
  scheduled_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
}

// Server-side client with service role key (for API routes only)
export function createServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_KEY is required for server operations");
  }
  return createClient(getSupabaseUrl(), serviceKey);
}

// Service role client for indexing operations (bypasses RLS)
export function getServiceSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }

  return createClient(getSupabaseUrl(), serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============= INDEXING TYPES (Content Registry Indexer) =============

export interface IndexedContent {
  id: number;
  content_address: string;
  content_cid: string;
  metadata_cid: string;
  creator_address: string;
  name: string | null;
  description: string | null;
  image_url: string | null;
  animation_url: string | null;
  content_type: number;
  content_domain: string;
  visibility_level: number;
  is_encrypted: boolean;
  preview_cid: string | null;
  encryption_meta_cid: string | null;
  is_locked: boolean;
  minted_count: number;
  pending_count: number;
  tips_received: number;
  tags: string[];
  category: string | null;
  genre: string | null;
  created_at: string;
  updated_at: string;
  indexed_at: string;
}

export interface IndexedBundle {
  id: number;
  bundle_address: string;
  bundle_id: string;
  metadata_cid: string;
  creator_address: string;
  name: string | null;
  description: string | null;
  image_url: string | null;
  bundle_type: number;
  bundle_type_label: string;
  item_count: number;
  is_locked: boolean;
  is_active: boolean;
  minted_count: number;
  pending_count: number;
  artist: string | null;
  show_name: string | null;
  instructor: string | null;
  season_number: number | null;
  total_seasons: number | null;
  tags: string[];
  category: string | null;
  genre: string | null;
  year: string | null;
  created_at: string;
  updated_at: string;
  indexed_at: string;
}

export interface BundleContent {
  id: number;
  bundle_id: number;
  content_id: number;
  position: number;
  custom_title: string | null;
  custom_description: string | null;
  duration: number | null;
  added_at: string;
}

export interface IndexedCreator {
  id: number;
  creator_address: string;
  username: string | null;
  total_content_count: number;
  total_bundle_count: number;
  total_mints: number;
  total_tips: number;
  first_seen_at: string;
  last_activity_at: string;
  indexed_at: string;
}

export interface IndexedOwnership {
  id: number;
  nft_address: string;
  owner_address: string;
  content_id: number | null;
  bundle_id: number | null;
  collection_address: string | null;
  name: string | null;
  rarity: number | null;
  weight: number | null;
  minted_at: string;
  indexed_at: string;
}

export interface TrendingContent extends IndexedContent {
  recent_mints: number;
  last_mint_at: string;
}

export interface TrendingBundle extends IndexedBundle {
  recent_mints: number;
  last_mint_at: string;
}

export interface CreatorLeaderboard extends IndexedCreator {
  // Same as IndexedCreator, just ordered by total_mints
}

// ============= REWARD ACCOUNTING TYPES =============

export interface RewardTransaction {
  id: string;
  signature: string;
  slot: number;
  block_time: string;
  event_type: "deposit" | "distribution" | "claim" | "transfer";
  pool_type: number;
  pool_pda: string;
  amount: number;
  payer: string | null;
  recipient: string | null;
  source_type: number | null;
  source_pda: string | null;
  content_pda: string | null;
  bundle_pda: string | null;
  creator_amount: number | null;
  platform_amount: number | null;
  ecosystem_amount: number | null;
  holder_amount: number | null;
  rps_before: string | null;
  rps_after: string | null;
  debt_cleared: number | null;
  indexed_at: string;
}

export interface CreatorRevenue {
  creator_wallet: string;
  content_pda: string | null;
  bundle_pda: string | null;
  period_start: string;
  period_type: "day" | "week" | "month" | "all_time";
  mint_revenue: number;
  rental_revenue: number;
  subscription_revenue: number;
  holder_rewards: number;
  mint_count: number;
  rental_count: number;
  unique_buyers: number;
}

export interface UserEarnings {
  wallet: string;
  pool_type: number;
  period_start: string;
  period_type: "day" | "week" | "month" | "all_time";
  total_claimed: number;
  total_pending: number;
  claim_count: number;
}

export interface PoolSnapshot {
  id: string;
  pool_pda: string;
  pool_type: number;
  total_deposited: number;
  total_distributed: number;
  total_claimed: number;
  current_balance: number;
  rps: string;
  share_count: number;
  snapshot_at: string;
  epoch: number | null;
}

// ============= CREATOR LANDING PAGE TYPES =============

export interface CreatorProfileSettings {
  id: number;
  creator_address: string;
  banner_cid: string | null;
  banner_url: string | null;
  bio: string | null;
  tagline: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorSocialLink {
  id: number;
  creator_address: string;
  platform: string;
  url: string;
  display_name: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatorAnnouncement {
  id: number;
  creator_address: string;
  title: string;
  content: string;
  link_url: string | null;
  link_text: string | null;
  is_pinned: boolean;
  is_active: boolean;
  published_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorFeaturedContent {
  id: number;
  creator_address: string;
  content_type: 'content' | 'bundle';
  content_cid: string;
  position: number;
  is_hero: boolean;
  custom_title: string | null;
  custom_description: string | null;
  created_at: string;
  updated_at: string;
}
