use anchor_lang::prelude::*;
use mpl_core::instructions::{CreateV2CpiBuilder, AddPluginV1CpiBuilder};
use mpl_core::types::{
    DataState, Plugin, PluginAuthority,
    FreezeDelegate,
};

use crate::state::*;
use crate::errors::ContentRegistryError;
use crate::MPL_CORE_ID;

/// Seed for bundle rental NFT assets
pub const BUNDLE_RENTAL_NFT_SEED: &[u8] = b"bundle_rental_nft";

// ============================================================================
// CONFIGURE BUNDLE RENT - Set up rental for a bundle
// ============================================================================

#[derive(Accounts)]
pub struct ConfigureBundleRent<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// The bundle to configure renting for
    /// Can be done before publishing (is_active=false)
    #[account(
        has_one = creator
    )]
    pub bundle: Account<'info, Bundle>,

    /// Rent config PDA for the bundle
    #[account(
        init,
        payer = creator,
        space = 8 + BundleRentConfig::INIT_SPACE,
        seeds = [BUNDLE_RENT_CONFIG_SEED, bundle.key().as_ref()],
        bump
    )]
    pub rent_config: Account<'info, BundleRentConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handle_configure_bundle_rent(
    ctx: Context<ConfigureBundleRent>,
    rent_fee_6h: u64,
    rent_fee_1d: u64,
    rent_fee_7d: u64,
) -> Result<()> {
    // Validate all rent fees meet minimum
    require!(
        BundleRentConfig::validate_fee(rent_fee_6h),
        ContentRegistryError::RentFeeTooLow
    );
    require!(
        BundleRentConfig::validate_fee(rent_fee_1d),
        ContentRegistryError::RentFeeTooLow
    );
    require!(
        BundleRentConfig::validate_fee(rent_fee_7d),
        ContentRegistryError::RentFeeTooLow
    );

    let clock = Clock::get()?;

    let rent_config = &mut ctx.accounts.rent_config;
    rent_config.bundle = ctx.accounts.bundle.key();
    rent_config.creator = ctx.accounts.creator.key();
    rent_config.rent_fee_6h = rent_fee_6h;
    rent_config.rent_fee_1d = rent_fee_1d;
    rent_config.rent_fee_7d = rent_fee_7d;
    rent_config.is_active = true;
    rent_config.total_rentals = 0;
    rent_config.total_fees_collected = 0;
    rent_config.created_at = clock.unix_timestamp;
    rent_config.updated_at = clock.unix_timestamp;

    msg!("Bundle rent configured: 6h={}, 1d={}, 7d={}",
        rent_fee_6h, rent_fee_1d, rent_fee_7d);

    Ok(())
}

// ============================================================================
// UPDATE BUNDLE RENT CONFIG
// ============================================================================

#[derive(Accounts)]
pub struct UpdateBundleRentConfig<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        has_one = creator
    )]
    pub bundle: Account<'info, Bundle>,

    #[account(
        mut,
        has_one = creator,
        seeds = [BUNDLE_RENT_CONFIG_SEED, bundle.key().as_ref()],
        bump
    )]
    pub rent_config: Account<'info, BundleRentConfig>,
}

pub fn handle_update_bundle_rent_config(
    ctx: Context<UpdateBundleRentConfig>,
    rent_fee_6h: Option<u64>,
    rent_fee_1d: Option<u64>,
    rent_fee_7d: Option<u64>,
    is_active: Option<bool>,
) -> Result<()> {
    let rent_config = &mut ctx.accounts.rent_config;
    let clock = Clock::get()?;

    if let Some(fee) = rent_fee_6h {
        require!(
            BundleRentConfig::validate_fee(fee),
            ContentRegistryError::RentFeeTooLow
        );
        rent_config.rent_fee_6h = fee;
    }

    if let Some(fee) = rent_fee_1d {
        require!(
            BundleRentConfig::validate_fee(fee),
            ContentRegistryError::RentFeeTooLow
        );
        rent_config.rent_fee_1d = fee;
    }

    if let Some(fee) = rent_fee_7d {
        require!(
            BundleRentConfig::validate_fee(fee),
            ContentRegistryError::RentFeeTooLow
        );
        rent_config.rent_fee_7d = fee;
    }

    if let Some(active) = is_active {
        rent_config.is_active = active;
    }

    rent_config.updated_at = clock.unix_timestamp;

    Ok(())
}

// ============================================================================
// RENT BUNDLE SOL - Rent a bundle with SOL payment
// ============================================================================

#[derive(Accounts)]
pub struct RentBundleSol<'info> {
    #[account(
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump
    )]
    pub ecosystem_config: Box<Account<'info, EcosystemConfig>>,

    #[account(
        constraint = bundle.is_active @ ContentRegistryError::BundleNotActive
    )]
    pub bundle: Box<Account<'info, Bundle>>,

    #[account(
        mut,
        seeds = [BUNDLE_RENT_CONFIG_SEED, bundle.key().as_ref()],
        bump,
        constraint = rent_config.is_active @ ContentRegistryError::RentingNotActive
    )]
    pub rent_config: Box<Account<'info, BundleRentConfig>>,

    /// Bundle-specific reward pool
    #[account(
        init_if_needed,
        payer = renter,
        space = 8 + BundleRewardPool::INIT_SPACE,
        seeds = [BUNDLE_REWARD_POOL_SEED, bundle.key().as_ref()],
        bump
    )]
    pub bundle_reward_pool: Box<Account<'info, BundleRewardPool>>,

    /// BundleCollection tracker PDA (must exist from configure_bundle_mint)
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

    /// CHECK: NFT asset for rental
    #[account(mut)]
    pub nft_asset: Signer<'info>,

    /// Rent entry PDA to track this rental
    /// CHECK: Manually created and initialized
    #[account(
        mut,
        seeds = [BUNDLE_RENT_ENTRY_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub rent_entry: AccountInfo<'info>,

    #[account(mut)]
    pub renter: Signer<'info>,

    /// CHECK: MPL Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_rent_bundle_sol(ctx: Context<RentBundleSol>, tier: RentTier) -> Result<()> {
    let clock = Clock::get()?;

    // Check ecosystem not paused
    require!(!ctx.accounts.ecosystem_config.is_paused, ContentRegistryError::EcosystemPaused);

    // Verify collection_asset matches what's stored in bundle_collection
    require!(
        ctx.accounts.bundle_collection.collection_asset == ctx.accounts.collection_asset.key(),
        ContentRegistryError::BundleMismatch
    );

    let bundle_key = ctx.accounts.bundle.key();
    let nft_asset_key = ctx.accounts.nft_asset.key();

    // Initialize bundle reward pool if needed
    if ctx.accounts.bundle_reward_pool.bundle == Pubkey::default() {
        ctx.accounts.bundle_reward_pool.bundle = bundle_key;
        ctx.accounts.bundle_reward_pool.created_at = clock.unix_timestamp;
    }

    // Get fee and period based on selected tier
    let rent_fee = ctx.accounts.rent_config.get_fee_for_tier(tier);
    let rent_period = BundleRentConfig::get_period_for_tier(tier);
    let expires_at = clock.unix_timestamp + rent_period;
    let had_existing_nfts = ctx.accounts.bundle_reward_pool.total_weight > 0;

    // Process payment using primary sale distribution
    if rent_fee > 0 {
        let (creator_amount, platform_amount, ecosystem_amount, holder_reward_amount) =
            EcosystemConfig::calculate_primary_split(rent_fee);

        // For rentals, if no existing NFTs, holder reward goes to creator
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
                        from: ctx.accounts.renter.to_account_info(),
                        to: ctx.accounts.creator.to_account_info(),
                    },
                ),
                final_creator_amount,
            )?;
        }

        // Transfer holder reward to bundle reward pool (if existing NFTs)
        if had_existing_nfts && holder_reward_amount > 0 {
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.renter.to_account_info(),
                        to: ctx.accounts.bundle_reward_pool.to_account_info(),
                    },
                ),
                holder_reward_amount,
            )?;

            // Update reward_per_share for existing holders
            ctx.accounts.bundle_reward_pool.add_rewards(holder_reward_amount);
        }

        // Transfer to platform
        if platform_amount > 0 {
            let platform_wallet = ctx.accounts.platform.as_ref()
                .map(|p| p.key())
                .unwrap_or(ctx.accounts.ecosystem_config.treasury);

            let platform_account = ctx.accounts.platform.as_ref()
                .map(|p| p.to_account_info())
                .unwrap_or_else(|| ctx.accounts.treasury.to_account_info());

            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.renter.to_account_info(),
                        to: platform_account,
                    },
                ),
                platform_amount,
            )?;
        }

        // Transfer to ecosystem treasury
        if ecosystem_amount > 0 {
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.renter.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                ),
                ecosystem_amount,
            )?;
        }
    }

    // Verify and create RentEntry PDA
    let (rent_entry_pda, rent_entry_bump) = Pubkey::find_program_address(
        &[BUNDLE_RENT_ENTRY_SEED, nft_asset_key.as_ref()],
        ctx.program_id,
    );
    require!(
        ctx.accounts.rent_entry.key() == rent_entry_pda,
        ContentRegistryError::InvalidBundleRentEntry
    );

    // Create the RentEntry account
    let space = 8 + BundleRentEntry::INIT_SPACE;
    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(space);

    let seeds: &[&[u8]] = &[BUNDLE_RENT_ENTRY_SEED, nft_asset_key.as_ref(), &[rent_entry_bump]];
    let signer_seeds = &[seeds];

    anchor_lang::system_program::create_account(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::CreateAccount {
                from: ctx.accounts.renter.to_account_info(),
                to: ctx.accounts.rent_entry.clone(),
            },
            signer_seeds,
        ),
        lamports,
        space as u64,
        ctx.program_id,
    )?;

    // Initialize RentEntry data
    {
        let mut data = ctx.accounts.rent_entry.try_borrow_mut_data()?;
        let discriminator = BundleRentEntry::DISCRIMINATOR;
        data[0..8].copy_from_slice(&discriminator);

        // Write renter (32 bytes)
        data[8..40].copy_from_slice(&ctx.accounts.renter.key().to_bytes());
        // Write bundle (32 bytes)
        data[40..72].copy_from_slice(&bundle_key.to_bytes());
        // Write nft_asset (32 bytes)
        data[72..104].copy_from_slice(&nft_asset_key.to_bytes());
        // Write rented_at (8 bytes)
        data[104..112].copy_from_slice(&clock.unix_timestamp.to_le_bytes());
        // Write expires_at (8 bytes)
        data[112..120].copy_from_slice(&expires_at.to_le_bytes());
        // Write is_active (1 byte)
        data[120] = 1; // true
        // Write fee_paid (8 bytes)
        data[121..129].copy_from_slice(&rent_fee.to_le_bytes());
    }

    // Create frozen rental NFT (non-transferable)
    let rental_nft_name = format!("Bundle Rental #{}", ctx.accounts.rent_config.total_rentals + 1);
    let rental_nft_uri = format!("https://ipfs.filebase.io/ipfs/{}", ctx.accounts.bundle.metadata_cid);

    // Derive bundle_collection PDA for signing
    let (_, bundle_collection_bump) = Pubkey::find_program_address(
        &[BUNDLE_COLLECTION_SEED, bundle_key.as_ref()],
        ctx.program_id,
    );

    let signer_seeds: &[&[&[u8]]] = &[&[
        BUNDLE_COLLECTION_SEED,
        bundle_key.as_ref(),
        &[bundle_collection_bump],
    ]];

    // Create rental NFT within the bundle's collection
    CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .asset(&ctx.accounts.nft_asset.to_account_info())
        .collection(Some(&ctx.accounts.collection_asset))
        .authority(Some(&ctx.accounts.bundle_collection.to_account_info()))
        .payer(&ctx.accounts.renter.to_account_info())
        .owner(Some(&ctx.accounts.renter.to_account_info()))
        .system_program(&ctx.accounts.system_program.to_account_info())
        .name(rental_nft_name)
        .uri(rental_nft_uri)
        .data_state(DataState::AccountState)
        .invoke_signed(signer_seeds)?;

    // Add FreezeDelegate plugin and freeze it (non-transferable)
    AddPluginV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .asset(&ctx.accounts.nft_asset.to_account_info())
        .collection(Some(&ctx.accounts.collection_asset))
        .payer(&ctx.accounts.renter.to_account_info())
        .authority(Some(&ctx.accounts.renter.to_account_info()))
        .system_program(&ctx.accounts.system_program.to_account_info())
        .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: true }))
        .init_authority(PluginAuthority::None)  // Permanently frozen
        .invoke()?;

    // Update rent config stats
    {
        let rent_config = &mut ctx.accounts.rent_config;
        rent_config.total_rentals += 1;
        rent_config.total_fees_collected += rent_fee;
        rent_config.updated_at = clock.unix_timestamp;
    }

    msg!("Bundle rented: tier={:?}, fee={}, expires_at={}",
        tier, rent_fee, expires_at);

    Ok(())
}

// ============================================================================
// CHECK BUNDLE RENT EXPIRY
// ============================================================================

#[derive(Accounts)]
pub struct CheckBundleRentExpiry<'info> {
    #[account(
        seeds = [BUNDLE_RENT_ENTRY_SEED, rent_entry.nft_asset.as_ref()],
        bump
    )]
    pub rent_entry: Account<'info, BundleRentEntry>,
}

pub fn handle_check_bundle_rent_expiry(ctx: Context<CheckBundleRentExpiry>) -> Result<()> {
    let rent_entry = &ctx.accounts.rent_entry;
    let clock = Clock::get()?;

    if rent_entry.is_expired(clock.unix_timestamp) {
        msg!("Bundle rental expired at {}, current time {}", rent_entry.expires_at, clock.unix_timestamp);
        return Err(ContentRegistryError::RentalExpired.into());
    }

    msg!("Bundle rental valid until {}, remaining {} seconds",
        rent_entry.expires_at,
        rent_entry.remaining_time(clock.unix_timestamp)
    );

    Ok(())
}
