use anchor_lang::prelude::*;
use mpl_core::instructions::CreateCollectionV2CpiBuilder;
use mpl_core::types::{
    Plugin, PluginAuthorityPair,
    Royalties, Creator, RuleSet,
};

use crate::state::*;
use crate::state::profile::{UserProfile, USER_PROFILE_SEED};
use crate::errors::ContentRegistryError;
use crate::{MPL_CORE_ID, DEFAULT_MAX_SUPPLY};

// ============================================================================
// CREATE BUNDLE WITH MINT AND RENT - All-in-one bundle creation
// ============================================================================

/// Create a bundle with mint and rent configuration in a single transaction
/// This combines:
/// - CreateBundle: Creates the bundle PDA
/// - ConfigureBundleMint: Sets up minting with Metaplex collection
/// - ConfigureBundleRent: Sets up rental tiers
///
/// Bundle is created as published (is_active=true) with mint and rent enabled
#[derive(Accounts)]
#[instruction(bundle_id: String)]
pub struct CreateBundleWithMintAndRent<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// The bundle to create
    #[account(
        init,
        payer = creator,
        space = Bundle::space(),
        seeds = [BUNDLE_SEED, creator.key().as_ref(), bundle_id.as_bytes()],
        bump
    )]
    pub bundle: Account<'info, Bundle>,

    /// Mint config PDA for the bundle - also serves as collection authority
    #[account(
        init,
        payer = creator,
        space = 8 + MintConfig::INIT_SPACE,
        seeds = [MINT_CONFIG_SEED, bundle.key().as_ref()],
        bump
    )]
    pub mint_config: Account<'info, MintConfig>,

    /// Rent config PDA for the bundle
    #[account(
        init,
        payer = creator,
        space = 8 + RentConfig::INIT_SPACE,
        seeds = [RENT_CONFIG_SEED, bundle.key().as_ref()],
        bump
    )]
    pub rent_config: Account<'info, RentConfig>,

    /// CHECK: The Metaplex Core Collection asset to create
    /// Address stored in bundle.collection_asset
    #[account(mut)]
    pub collection_asset: Signer<'info>,

    /// Ecosystem config for treasury address
    #[account(
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump
    )]
    pub ecosystem_config: Account<'info, EcosystemConfig>,

    /// CHECK: Platform wallet for royalties
    #[account()]
    pub platform: AccountInfo<'info>,

    /// User profile for collection naming
    /// Collection name format: "HC: <Username>" or "HC: <Username>: <CollectionName>"
    #[account(
        seeds = [USER_PROFILE_SEED, creator.key().as_ref()],
        bump,
        constraint = user_profile.owner == creator.key() @ ContentRegistryError::Unauthorized
    )]
    pub user_profile: Account<'info, UserProfile>,

    /// CHECK: MPL Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_create_bundle_with_mint_and_rent(
    ctx: Context<CreateBundleWithMintAndRent>,
    bundle_id: String,
    metadata_cid: String,
    bundle_type: BundleType,
    // Mint config
    mint_price: u64,
    mint_max_supply: Option<u64>,
    creator_royalty_bps: u16,
    // Rent config
    rent_fee_6h: u64,
    rent_fee_1d: u64,
    rent_fee_7d: u64,
    // Collection naming
    collection_name: Option<String>,
    // Visibility level (0=Public, 1=Ecosystem, 2=Subscriber, 3=NFT Only)
    visibility_level: Option<u8>,
) -> Result<()> {
    require!(metadata_cid.len() <= 64, ContentRegistryError::CidTooLong);

    // Validate visibility level (0-3), default to Level 1 (Ecosystem)
    let vis_level = visibility_level.unwrap_or(1);
    require!(vis_level <= 3, ContentRegistryError::InvalidVisibilityLevel);
    // Validate mint price
    require!(
        MintConfig::validate_price(mint_price, PaymentCurrency::Sol),
        ContentRegistryError::PriceTooLow
    );

    // Validate royalty
    require!(
        MintConfig::validate_royalty(creator_royalty_bps),
        ContentRegistryError::InvalidRoyalty
    );

    // Validate max_supply doesn't exceed limit (for 6-digit edition format)
    if let Some(supply) = mint_max_supply {
        require!(supply <= DEFAULT_MAX_SUPPLY, ContentRegistryError::MaxSupplyTooHigh);
    }

    // Validate rent fees
    require!(
        RentConfig::validate_fee(rent_fee_6h),
        ContentRegistryError::RentFeeTooLow
    );
    require!(
        RentConfig::validate_fee(rent_fee_1d),
        ContentRegistryError::RentFeeTooLow
    );
    require!(
        RentConfig::validate_fee(rent_fee_7d),
        ContentRegistryError::RentFeeTooLow
    );

    let clock = Clock::get()?;
    let bundle_key = ctx.accounts.bundle.key();

    // ========== 1. Initialize Bundle ==========
    let bundle = &mut ctx.accounts.bundle;
    bundle.creator = ctx.accounts.creator.key();
    bundle.bundle_id = bundle_id.clone();
    bundle.collection_asset = ctx.accounts.collection_asset.key(); // Store directly
    bundle.bundle_type = bundle_type;
    bundle.item_count = 0;
    bundle.is_active = true; // Published by default
    bundle.is_locked = false;
    bundle.minted_count = 0;
    bundle.pending_count = 0;
    bundle.visibility_level = vis_level;
    bundle.created_at = clock.unix_timestamp;
    bundle.updated_at = clock.unix_timestamp;

    // ========== 2. Initialize Mint Config ==========
    let mint_config = &mut ctx.accounts.mint_config;
    mint_config.item_type = ItemType::Bundle;
    mint_config.item = bundle_key;
    mint_config.creator = ctx.accounts.creator.key();
    mint_config.price = mint_price;
    mint_config.currency = PaymentCurrency::Sol;
    // Default to DEFAULT_MAX_SUPPLY if not specified
    mint_config.max_supply = Some(mint_max_supply.unwrap_or(DEFAULT_MAX_SUPPLY));
    mint_config.creator_royalty_bps = creator_royalty_bps;
    mint_config.is_active = true;
    mint_config.created_at = clock.unix_timestamp;
    mint_config.updated_at = clock.unix_timestamp;

    // ========== 3. Initialize Rent Config ==========
    let rent_config = &mut ctx.accounts.rent_config;
    rent_config.item_type = ItemType::Bundle;
    rent_config.item = bundle_key;
    rent_config.creator = ctx.accounts.creator.key();
    rent_config.rent_fee_6h = rent_fee_6h;
    rent_config.rent_fee_1d = rent_fee_1d;
    rent_config.rent_fee_7d = rent_fee_7d;
    rent_config.is_active = true;
    rent_config.total_rentals = 0;
    rent_config.total_fees_collected = 0;
    rent_config.created_at = clock.unix_timestamp;
    rent_config.updated_at = clock.unix_timestamp;

    // ========== 4. Create Metaplex Core Collection ==========
    // Derive RewardPool PDA for holder royalties
    let (holder_reward_pool, _) = Pubkey::find_program_address(
        &[REWARD_POOL_SEED, bundle_key.as_ref()],
        ctx.program_id,
    );

    // Create the Metaplex Core Collection with Royalties plugin
    // Collection name format: "HC: <Username>" or "HC: <Username>: <CollectionName>"
    let username = &ctx.accounts.user_profile.username;
    let collection_name_str = match &collection_name {
        Some(name) => format!("HC: {}: {}", username, name),
        None => format!("HC: {}", username),
    };
    // Collection metadata URI points to IPFS (on-chain accessible)
    let collection_uri = format!("https://ipfs.filebase.io/ipfs/{}", metadata_cid);

    // Calculate royalty shares
    let total_royalty_bps = EcosystemConfig::total_secondary_royalty_bps(creator_royalty_bps);
    let creator_share = (creator_royalty_bps as u32 * 100 / total_royalty_bps as u32) as u8;
    let platform_share = (100_u32 * 100 / total_royalty_bps as u32) as u8;
    let treasury_share = (100_u32 * 100 / total_royalty_bps as u32) as u8;
    let holder_share = 100 - creator_share - platform_share - treasury_share;

    // Build creators vec (deduplicate)
    let mut creators_map: std::collections::BTreeMap<Pubkey, u8> = std::collections::BTreeMap::new();
    *creators_map.entry(ctx.accounts.creator.key()).or_insert(0) += creator_share;
    *creators_map.entry(ctx.accounts.platform.key()).or_insert(0) += platform_share;
    *creators_map.entry(ctx.accounts.ecosystem_config.treasury).or_insert(0) += treasury_share;
    *creators_map.entry(holder_reward_pool).or_insert(0) += holder_share;

    let creators_vec: Vec<Creator> = creators_map
        .into_iter()
        .map(|(address, percentage)| Creator { address, percentage })
        .collect();

    let royalties = Royalties {
        basis_points: total_royalty_bps,
        creators: creators_vec,
        rule_set: RuleSet::None,
    };

    let royalties_plugin = PluginAuthorityPair {
        plugin: Plugin::Royalties(royalties),
        authority: None,
    };

    // Create collection with mint_config PDA as update authority
    CreateCollectionV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
        .collection(&ctx.accounts.collection_asset.to_account_info())
        .payer(&ctx.accounts.creator.to_account_info())
        .update_authority(Some(&ctx.accounts.mint_config.to_account_info()))
        .system_program(&ctx.accounts.system_program.to_account_info())
        .name(collection_name_str)
        .uri(collection_uri)
        .plugins(vec![royalties_plugin])
        .invoke()?;

    msg!("Bundle created with mint and rent: id={}, type={:?}, visibility={}", bundle_id, bundle_type, vis_level);
    msg!("Mint: price={}, max_supply={:?}, royalty_bps={}", mint_price, mint_max_supply, creator_royalty_bps);
    msg!("Rent: 6h={}, 1d={}, 7d={}", rent_fee_6h, rent_fee_1d, rent_fee_7d);

    Ok(())
}
