use anchor_lang::prelude::*;
use mpl_core::instructions::CreateCollectionV2CpiBuilder;
use mpl_core::types::{
    Plugin, PluginAuthorityPair,
    Royalties, Creator, RuleSet,
};

use crate::state::*;
use crate::errors::ContentRegistryError;
use crate::{MPL_CORE_ID, DEFAULT_MAX_SUPPLY};

// ============================================================================
// CONFIGURE BUNDLE MINT - Set up minting for a bundle
// ============================================================================

/// Configure NFT minting for a bundle (creator only)
/// Creates the mint config and Metaplex Core collection
/// Can be done before publishing (is_active=false), but not after first mint (is_locked=true)
#[derive(Accounts)]
pub struct ConfigureBundleMint<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// The bundle to configure minting for
    #[account(
        mut,
        has_one = creator,
        constraint = !bundle.is_locked @ ContentRegistryError::BundleLocked
    )]
    pub bundle: Account<'info, Bundle>,

    /// Mint config PDA for the bundle
    #[account(
        init,
        payer = creator,
        space = 8 + BundleMintConfig::INIT_SPACE,
        seeds = [BUNDLE_MINT_CONFIG_SEED, bundle.key().as_ref()],
        bump
    )]
    pub mint_config: Account<'info, BundleMintConfig>,

    /// Bundle collection PDA (tracks the Metaplex collection)
    #[account(
        init,
        payer = creator,
        space = 8 + BundleCollection::INIT_SPACE,
        seeds = [BUNDLE_COLLECTION_SEED, bundle.key().as_ref()],
        bump
    )]
    pub bundle_collection: Account<'info, BundleCollection>,

    /// CHECK: The Metaplex Core Collection asset to create
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

    /// CHECK: MPL Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_configure_bundle_mint(
    ctx: Context<ConfigureBundleMint>,
    price: u64,
    max_supply: Option<u64>,
    creator_royalty_bps: u16,
) -> Result<()> {
    // Validate price
    require!(
        BundleMintConfig::validate_price(price),
        ContentRegistryError::PriceTooLow
    );

    // Validate royalty
    require!(
        BundleMintConfig::validate_royalty(creator_royalty_bps),
        ContentRegistryError::InvalidRoyalty
    );

    // Validate max_supply doesn't exceed limit (for 6-digit edition format)
    if let Some(supply) = max_supply {
        require!(supply <= DEFAULT_MAX_SUPPLY, ContentRegistryError::MaxSupplyTooHigh);
    }

    let clock = Clock::get()?;
    let bundle_key = ctx.accounts.bundle.key();

    // Initialize mint config
    let mint_config = &mut ctx.accounts.mint_config;
    mint_config.bundle = bundle_key;
    mint_config.creator = ctx.accounts.creator.key();
    mint_config.price = price;
    // Default to DEFAULT_MAX_SUPPLY if not specified
    mint_config.max_supply = Some(max_supply.unwrap_or(DEFAULT_MAX_SUPPLY));
    mint_config.creator_royalty_bps = creator_royalty_bps;
    mint_config.is_active = true;
    mint_config.created_at = clock.unix_timestamp;
    mint_config.updated_at = clock.unix_timestamp;

    // Initialize bundle collection
    let bundle_collection = &mut ctx.accounts.bundle_collection;
    bundle_collection.bundle = bundle_key;
    bundle_collection.collection_asset = ctx.accounts.collection_asset.key();
    bundle_collection.creator = ctx.accounts.creator.key();
    bundle_collection.created_at = clock.unix_timestamp;

    // Derive BundleRewardPool PDA for holder royalties
    let (holder_reward_pool, _) = Pubkey::find_program_address(
        &[BUNDLE_REWARD_POOL_SEED, bundle_key.as_ref()],
        ctx.program_id,
    );

    // Create the Metaplex Core Collection with Royalties plugin
    let collection_name = "Handcraft Bundle Collection".to_string();
    let collection_uri = format!("https://ipfs.filebase.io/ipfs/{}", ctx.accounts.bundle.metadata_cid);

    // Calculate royalty shares (same logic as content)
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

    // Create collection with bundle_collection as update authority
    CreateCollectionV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
        .collection(&ctx.accounts.collection_asset.to_account_info())
        .payer(&ctx.accounts.creator.to_account_info())
        .update_authority(Some(&ctx.accounts.bundle_collection.to_account_info()))
        .system_program(&ctx.accounts.system_program.to_account_info())
        .name(collection_name)
        .uri(collection_uri)
        .plugins(vec![royalties_plugin])
        .invoke()?;

    msg!("Bundle mint configured: price={}, max_supply={:?}, royalty_bps={}",
        price, max_supply, creator_royalty_bps);

    Ok(())
}

// ============================================================================
// UPDATE BUNDLE MINT SETTINGS
// ============================================================================

#[derive(Accounts)]
pub struct UpdateBundleMintSettings<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        has_one = creator
    )]
    pub bundle: Account<'info, Bundle>,

    #[account(
        mut,
        has_one = creator,
        seeds = [BUNDLE_MINT_CONFIG_SEED, bundle.key().as_ref()],
        bump
    )]
    pub mint_config: Account<'info, BundleMintConfig>,
}

pub fn handle_update_bundle_mint_settings(
    ctx: Context<UpdateBundleMintSettings>,
    price: Option<u64>,
    max_supply: Option<Option<u64>>,
    creator_royalty_bps: Option<u16>,
    is_active: Option<bool>,
) -> Result<()> {
    let bundle = &ctx.accounts.bundle;
    let mint_config = &mut ctx.accounts.mint_config;
    let clock = Clock::get()?;

    // Price can always be updated
    if let Some(new_price) = price {
        require!(
            BundleMintConfig::validate_price(new_price),
            ContentRegistryError::PriceTooLow
        );
        mint_config.price = new_price;
    }

    // Max supply restrictions after minting starts
    if let Some(new_max_supply) = max_supply {
        // Validate max_supply doesn't exceed limit (for 6-digit edition format)
        if let Some(new_max) = new_max_supply {
            require!(new_max <= DEFAULT_MAX_SUPPLY, ContentRegistryError::MaxSupplyTooHigh);
        }

        if bundle.minted_count > 0 {
            if let Some(new_max) = new_max_supply {
                require!(
                    new_max >= bundle.minted_count,
                    ContentRegistryError::SupplyBelowMinted
                );
                if let Some(current_max) = mint_config.max_supply {
                    require!(
                        new_max <= current_max,
                        ContentRegistryError::CannotIncreaseSupply
                    );
                }
            } else {
                return Err(ContentRegistryError::CannotIncreaseSupply.into());
            }
        }
        // Default to DEFAULT_MAX_SUPPLY if None passed
        mint_config.max_supply = Some(new_max_supply.unwrap_or(DEFAULT_MAX_SUPPLY));
    }

    // Royalty cannot change after first mint
    if let Some(new_royalty) = creator_royalty_bps {
        require!(bundle.minted_count == 0, ContentRegistryError::BundleLocked);
        require!(
            BundleMintConfig::validate_royalty(new_royalty),
            ContentRegistryError::InvalidRoyalty
        );
        mint_config.creator_royalty_bps = new_royalty;
    }

    // Active status can always be toggled
    if let Some(active) = is_active {
        mint_config.is_active = active;
    }

    mint_config.updated_at = clock.unix_timestamp;

    Ok(())
}
