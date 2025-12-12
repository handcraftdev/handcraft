use anchor_lang::prelude::*;
use mpl_core::instructions::CreateV2CpiBuilder;
use mpl_core::instructions::CreateCollectionV2CpiBuilder;
use mpl_core::types::{
    DataState, Plugin, PluginAuthorityPair,
    Royalties, Creator, RuleSet,
};

use crate::state::*;
use crate::errors::ContentRegistryError;
use crate::MPL_CORE_ID;

/// Seed for bundle direct mint NFT assets
/// PDA seeds: ["bundle_direct_nft", buyer, bundle, edition_bytes]
pub const BUNDLE_DIRECT_NFT_SEED: &[u8] = b"bundle_direct_nft";

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

    let clock = Clock::get()?;
    let bundle_key = ctx.accounts.bundle.key();

    // Initialize mint config
    let mint_config = &mut ctx.accounts.mint_config;
    mint_config.bundle = bundle_key;
    mint_config.creator = ctx.accounts.creator.key();
    mint_config.price = price;
    mint_config.max_supply = max_supply;
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
        mint_config.max_supply = new_max_supply;
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

// ============================================================================
// DIRECT MINT BUNDLE - Single transaction mint with slot hash randomness
// ============================================================================

#[derive(Accounts)]
pub struct DirectMintBundle<'info> {
    #[account(
        mut,
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump
    )]
    pub ecosystem_config: Box<Account<'info, EcosystemConfig>>,

    #[account(
        mut,
        constraint = bundle.is_active @ ContentRegistryError::BundleNotActive
    )]
    pub bundle: Box<Account<'info, Bundle>>,

    #[account(
        seeds = [BUNDLE_MINT_CONFIG_SEED, bundle.key().as_ref()],
        bump
    )]
    pub mint_config: Box<Account<'info, BundleMintConfig>>,

    /// Bundle-specific reward pool
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + BundleRewardPool::INIT_SPACE,
        seeds = [BUNDLE_REWARD_POOL_SEED, bundle.key().as_ref()],
        bump
    )]
    pub bundle_reward_pool: Box<Account<'info, BundleRewardPool>>,

    /// BundleCollection tracker PDA
    #[account(
        seeds = [BUNDLE_COLLECTION_SEED, bundle.key().as_ref()],
        bump
    )]
    pub bundle_collection: Box<Account<'info, BundleCollection>>,

    /// CHECK: The Metaplex Core Collection asset
    #[account(mut)]
    pub collection_asset: AccountInfo<'info>,

    /// CHECK: Creator to receive payment
    #[account(mut, constraint = bundle.creator == creator.key())]
    pub creator: AccountInfo<'info>,

    /// CHECK: Ecosystem treasury
    #[account(mut, constraint = ecosystem_config.treasury == treasury.key())]
    pub treasury: AccountInfo<'info>,

    /// CHECK: Optional platform wallet for commission
    #[account(mut)]
    pub platform: Option<AccountInfo<'info>>,

    /// Buyer's wallet state for tracking NFT ownership
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + BundleWalletState::INIT_SPACE,
        seeds = [BUNDLE_WALLET_STATE_SEED, payer.key().as_ref(), bundle.key().as_ref()],
        bump
    )]
    pub buyer_wallet_state: Box<Account<'info, BundleWalletState>>,

    /// CHECK: NFT asset - PDA based on buyer, bundle, and edition
    #[account(
        mut,
        seeds = [BUNDLE_DIRECT_NFT_SEED, payer.key().as_ref(), bundle.key().as_ref(), &(bundle.minted_count + 1).to_le_bytes()],
        bump
    )]
    pub nft_asset: AccountInfo<'info>,

    /// NFT reward state
    #[account(
        init,
        payer = payer,
        space = 8 + BundleNftRewardState::INIT_SPACE,
        seeds = [BUNDLE_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_reward_state: Box<Account<'info, BundleNftRewardState>>,

    /// NFT rarity state
    #[account(
        init,
        payer = payer,
        space = 8 + BundleNftRarity::INIT_SPACE,
        seeds = [BUNDLE_NFT_RARITY_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_rarity: Box<Account<'info, BundleNftRarity>>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Slot hashes sysvar for randomness
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: AccountInfo<'info>,

    /// CHECK: MPL Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_direct_mint_bundle(ctx: Context<DirectMintBundle>) -> Result<()> {
    let clock = Clock::get()?;

    // Capture values upfront
    let payer_key = ctx.accounts.payer.key();
    let bundle_key = ctx.accounts.bundle.key();
    let nft_asset_key = ctx.accounts.nft_asset.key();
    let _platform_key = ctx.accounts.platform.as_ref().map(|p| p.key()).unwrap_or(ctx.accounts.ecosystem_config.treasury);

    // Check minting is enabled
    require!(ctx.accounts.mint_config.is_active, ContentRegistryError::MintingNotActive);
    require!(!ctx.accounts.ecosystem_config.is_paused, ContentRegistryError::EcosystemPaused);

    // Check max supply
    require!(
        ctx.accounts.mint_config.can_mint(ctx.accounts.bundle.minted_count, ctx.accounts.bundle.pending_count),
        ContentRegistryError::MaxSupplyReached
    );

    // Calculate payment
    let mint_price = ctx.accounts.mint_config.price;
    let had_existing_nfts = ctx.accounts.bundle_reward_pool.total_weight > 0;
    let metadata_cid = ctx.accounts.bundle.metadata_cid.clone();

    // Generate randomness from slot hashes
    let slot_hashes_data = ctx.accounts.slot_hashes.try_borrow_data()?;
    let randomness_seed = solana_sha256_hasher::hashv(&[
        &slot_hashes_data[..std::cmp::min(64, slot_hashes_data.len())],
        nft_asset_key.as_ref(),
        payer_key.as_ref(),
        &clock.unix_timestamp.to_le_bytes(),
        &clock.slot.to_le_bytes(),
    ]);

    // Use standard rarity determination
    let rarity = Rarity::from_random(randomness_seed.to_bytes());
    let weight = rarity.weight();

    // Initialize NFT reward state
    ctx.accounts.nft_reward_state.nft_asset = nft_asset_key;
    ctx.accounts.nft_reward_state.bundle = bundle_key;
    ctx.accounts.nft_reward_state.weight = weight;
    ctx.accounts.nft_reward_state.created_at = clock.unix_timestamp;

    // Initialize NFT rarity
    ctx.accounts.nft_rarity.nft_asset = nft_asset_key;
    ctx.accounts.nft_rarity.bundle = bundle_key;
    ctx.accounts.nft_rarity.rarity = rarity.clone();
    ctx.accounts.nft_rarity.weight = weight;

    // Initialize bundle reward pool if needed
    if ctx.accounts.bundle_reward_pool.bundle == Pubkey::default() {
        ctx.accounts.bundle_reward_pool.bundle = bundle_key;
        ctx.accounts.bundle_reward_pool.total_deposited = 0;
        ctx.accounts.bundle_reward_pool.total_claimed = 0;
    }

    // Calculate edition number
    let edition = ctx.accounts.bundle.minted_count + 1;

    // Build NFT name and URI
    let nft_name = format!("Bundle #{}", edition);
    let nft_uri = format!("https://ipfs.io/ipfs/{}", metadata_cid);

    // Create NFT via Metaplex Core
    let bundle_collection_seeds = &[
        BUNDLE_COLLECTION_SEED,
        bundle_key.as_ref(),
        &[ctx.bumps.bundle_collection],
    ];

    let nft_seeds = &[
        BUNDLE_DIRECT_NFT_SEED,
        payer_key.as_ref(),
        bundle_key.as_ref(),
        &edition.to_le_bytes(),
        &[ctx.bumps.nft_asset],
    ];

    CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
        .asset(&ctx.accounts.nft_asset)
        .collection(Some(&ctx.accounts.collection_asset))
        .authority(Some(&ctx.accounts.bundle_collection.to_account_info()))
        .payer(&ctx.accounts.payer.to_account_info())
        .owner(Some(&ctx.accounts.payer.to_account_info()))
        .system_program(&ctx.accounts.system_program.to_account_info())
        .name(nft_name)
        .uri(nft_uri)
        .data_state(DataState::AccountState)
        .invoke_signed(&[bundle_collection_seeds, nft_seeds])?;

    // Update bundle minted count and lock if first mint
    ctx.accounts.bundle.minted_count = edition;
    if edition == 1 {
        ctx.accounts.bundle.is_locked = true;
    }

    // Distribute payment with correct order
    if mint_price > 0 {
        let (creator_amount, platform_amount, ecosystem_amount, holder_reward_amount) =
            EcosystemConfig::calculate_primary_split(mint_price);

        // For first NFT, holder reward goes to creator
        let final_creator_amount = if !had_existing_nfts {
            creator_amount + holder_reward_amount
        } else {
            creator_amount
        };

        // Transfer to creator
        if final_creator_amount > 0 {
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: ctx.accounts.creator.to_account_info(),
                    },
                ),
                final_creator_amount,
            )?;
        }

        // Transfer to platform
        if platform_amount > 0 {
            let platform_account = ctx.accounts.platform.as_ref()
                .map(|p| p.to_account_info())
                .unwrap_or_else(|| ctx.accounts.treasury.to_account_info());
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: platform_account,
                    },
                ),
                platform_amount,
            )?;
        }

        // Transfer to treasury
        if ecosystem_amount > 0 {
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                ),
                ecosystem_amount,
            )?;
        }

        // Transfer holder reward to pool and update reward_per_share FIRST
        if had_existing_nfts && holder_reward_amount > 0 {
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: ctx.accounts.bundle_reward_pool.to_account_info(),
                    },
                ),
                holder_reward_amount,
            )?;
            ctx.accounts.bundle_reward_pool.add_rewards(holder_reward_amount);
        }

        msg!("Payment distributed: creator={}, platform={}, ecosystem={}, holder_pool={}",
            final_creator_amount, platform_amount, ecosystem_amount,
            if had_existing_nfts { holder_reward_amount } else { 0 });
    }

    // Set reward_debt BEFORE adding NFT to pool
    ctx.accounts.nft_reward_state.reward_debt =
        (weight as u128) * ctx.accounts.bundle_reward_pool.reward_per_share;

    // Add new NFT to pool's tracking
    ctx.accounts.bundle_reward_pool.add_nft(weight);

    // Update buyer wallet state
    if ctx.accounts.buyer_wallet_state.bundle == Pubkey::default() {
        ctx.accounts.buyer_wallet_state.wallet = payer_key;
        ctx.accounts.buyer_wallet_state.bundle = bundle_key;
        ctx.accounts.buyer_wallet_state.created_at = clock.unix_timestamp;
    }
    ctx.accounts.buyer_wallet_state.nft_count = ctx.accounts.buyer_wallet_state.nft_count.saturating_add(1);
    ctx.accounts.buyer_wallet_state.updated_at = clock.unix_timestamp;

    msg!("Bundle direct mint completed!");
    msg!("NFT: {} with {:?} rarity (weight: {})", nft_asset_key, rarity, weight);

    Ok(())
}
