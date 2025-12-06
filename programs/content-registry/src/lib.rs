use anchor_lang::prelude::*;
use anchor_lang::Discriminator;

// Import mpl-core types and CPI builders
use mpl_core::instructions::{CreateCollectionV2CpiBuilder, CreateV2CpiBuilder, AddPluginV1CpiBuilder};
use mpl_core::types::{
    DataState, Plugin, PluginAuthorityPair, PluginAuthority,
    Royalties, Creator, RuleSet, FreezeDelegate,
};

// Metaplex Core Program ID: CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d
pub const MPL_CORE_ID: Pubkey = Pubkey::new_from_array([
    0xaf, 0x54, 0xab, 0x10, 0xbd, 0x97, 0xa5, 0x42,
    0xa0, 0x9e, 0xf7, 0xb3, 0x98, 0x89, 0xdd, 0x0c,
    0xd3, 0x94, 0xa4, 0xcc, 0xe9, 0xdf, 0xa6, 0xcd,
    0xc9, 0x7e, 0xbe, 0x2d, 0x23, 0x5b, 0xa7, 0x48,
]);

/// Create a Metaplex Core Collection with Royalties plugin
/// NFTs minted into this collection inherit the royalty configuration
/// This enforces secondary sale royalties on-chain
///
/// Royalty distribution on secondary sales:
/// - Creator: 2-10% (configurable)
/// - Platform: 1%
/// - Ecosystem (Treasury): 1%
/// - Holder Reward Pool: 8%
fn create_collection<'info>(
    mpl_core_program: &AccountInfo<'info>,
    collection: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    update_authority: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    name: String,
    uri: String,
    creator: Pubkey,
    platform: Pubkey,
    treasury: Pubkey,
    holder_reward_pool: Pubkey,
    creator_royalty_bps: u16,
) -> Result<()> {
    // Calculate total royalty in basis points
    // Creator royalty (2-10%) + Platform (1%) + Ecosystem (1%) + Holders (8%)
    let total_royalty_bps = EcosystemConfig::total_secondary_royalty_bps(creator_royalty_bps);

    // Calculate percentage share for each recipient (must sum to 100)
    // Using basis points for precision, then converting to percentage
    let creator_share = (creator_royalty_bps as u32 * 100 / total_royalty_bps as u32) as u8;
    let platform_share = (100_u32 * 100 / total_royalty_bps as u32) as u8;  // 1% = 100 bps
    let treasury_share = (100_u32 * 100 / total_royalty_bps as u32) as u8;  // 1% = 100 bps
    let holder_share = 100 - creator_share - platform_share - treasury_share; // Remainder to holders

    // Log the values for debugging
    msg!("=== Royalties Debug START ===");
    msg!("Step 1: Input values");
    msg!("  creator_royalty_bps: {}", creator_royalty_bps);
    msg!("  total_royalty_bps: {}", total_royalty_bps);

    msg!("Step 2: Calculated shares (u8 percentages)");
    msg!("  creator_share: {} (type u8)", creator_share);
    msg!("  platform_share: {} (type u8)", platform_share);
    msg!("  treasury_share: {} (type u8)", treasury_share);
    msg!("  holder_share: {} (type u8)", holder_share);
    msg!("  sum: {}", creator_share as u16 + platform_share as u16 + treasury_share as u16 + holder_share as u16);

    msg!("Step 3: Addresses");
    msg!("  creator (param 1): {}", creator);
    msg!("  platform (param 2): {}", platform);
    msg!("  treasury (param 3): {}", treasury);
    msg!("  holder_reward_pool (param 4): {}", holder_reward_pool);

    msg!("Step 4: Checking for duplicate addresses");
    msg!("  creator == platform: {}", creator == platform);
    msg!("  creator == treasury: {}", creator == treasury);
    msg!("  creator == holder_reward_pool: {}", creator == holder_reward_pool);
    msg!("  platform == treasury: {}", platform == treasury);
    msg!("  platform == holder_reward_pool: {}", platform == holder_reward_pool);
    msg!("  treasury == holder_reward_pool: {}", treasury == holder_reward_pool);

    msg!("Step 5: Account info keys");
    msg!("  collection.key(): {}", collection.key());
    msg!("  update_authority.key(): {}", update_authority.key());
    msg!("  payer.key(): {}", payer.key());
    msg!("  mpl_core_program.key(): {}", mpl_core_program.key());

    msg!("Step 6: Building creators vec (deduplicating if needed)");
    // Metaplex Core requires unique addresses - deduplicate by combining percentages
    let mut creators_map: std::collections::BTreeMap<Pubkey, u8> = std::collections::BTreeMap::new();

    // Add each recipient, combining percentages if address already exists
    *creators_map.entry(creator).or_insert(0) += creator_share;
    *creators_map.entry(platform).or_insert(0) += platform_share;
    *creators_map.entry(treasury).or_insert(0) += treasury_share;
    *creators_map.entry(holder_reward_pool).or_insert(0) += holder_share;

    // Convert to Creator vec
    let creators_vec: Vec<Creator> = creators_map
        .into_iter()
        .map(|(address, percentage)| Creator { address, percentage })
        .collect();

    for (i, c) in creators_vec.iter().enumerate() {
        msg!("  Creator {}: addr={}, pct={}", i + 1, c.address, c.percentage);
    }
    msg!("  creators_vec len: {} (deduplicated from 4)", creators_vec.len());

    msg!("Step 7: Building Royalties struct");
    let royalties = Royalties {
        basis_points: total_royalty_bps,
        creators: creators_vec,
        rule_set: RuleSet::None,
    };
    msg!("  royalties.basis_points: {}", royalties.basis_points);
    msg!("  royalties.creators.len(): {}", royalties.creators.len());

    msg!("Step 8: Building Plugin enum");
    let plugin = Plugin::Royalties(royalties);
    msg!("  Plugin variant: Royalties");

    msg!("Step 9: Building PluginAuthorityPair");
    // Create the Royalties plugin with all recipients
    let royalties_plugin = PluginAuthorityPair {
        plugin,
        authority: None,
    };
    msg!("  authority: None");
    msg!("=== Royalties Debug END ===");

    // Create the collection with Royalties plugin
    CreateCollectionV2CpiBuilder::new(mpl_core_program)
        .collection(collection)
        .payer(payer)
        .update_authority(Some(update_authority))
        .system_program(system_program)
        .name(name)
        .uri(uri)
        .plugins(vec![royalties_plugin])
        .invoke()?;

    Ok(())
}

/// Verify a Metaplex Core NFT asset
/// Returns Ok(true) if the asset belongs to the expected collection and is owned by the expected owner
///
/// Metaplex Core Asset layout:
/// - Offset 0: Key (1 byte) - must be 1 for Asset
/// - Offset 1-32: Owner (32 bytes Pubkey)
/// - Offset 33: UpdateAuthority type (1 byte) - 0=None, 1=Address, 2=Collection
/// - Offset 34-65: UpdateAuthority value (32 bytes Pubkey) - for Collection type, this is the collection address
fn verify_core_nft_ownership(
    asset_info: &AccountInfo,
    expected_owner: &Pubkey,
    expected_collection: &Pubkey,
) -> Result<bool> {
    // Check account is owned by Metaplex Core program
    if asset_info.owner != &MPL_CORE_ID {
        return Ok(false);
    }

    let data = asset_info.try_borrow_data()?;

    // Minimum size check: key(1) + owner(32) + update_authority_type(1) + update_authority_value(32) = 66
    if data.len() < 66 {
        return Ok(false);
    }

    // Check Key byte is 1 (Asset type)
    if data[0] != 1 {
        return Ok(false);
    }

    // Extract owner (bytes 1-32)
    let owner_bytes: [u8; 32] = data[1..33].try_into().map_err(|_| ContentRegistryError::InvalidNftAsset)?;
    let owner = Pubkey::new_from_array(owner_bytes);

    // Check owner matches expected
    if owner != *expected_owner {
        return Ok(false);
    }

    // Extract UpdateAuthority type (byte 33)
    let update_authority_type = data[33];

    // Type 2 = Collection
    if update_authority_type != 2 {
        return Ok(false);
    }

    // Extract collection address (bytes 34-65)
    let collection_bytes: [u8; 32] = data[34..66].try_into().map_err(|_| ContentRegistryError::InvalidNftAsset)?;
    let collection = Pubkey::new_from_array(collection_bytes);

    // Check collection matches expected
    if collection != *expected_collection {
        return Ok(false);
    }

    Ok(true)
}

/// Create a Metaplex Core NFT within a collection
/// The content_collection PDA is the update_authority and must sign
fn create_core_nft<'info>(
    mpl_core_program: &AccountInfo<'info>,
    asset: &AccountInfo<'info>,
    collection: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,  // content_collection PDA
    payer: &AccountInfo<'info>,
    owner: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    name: String,
    uri: String,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    // Create NFT within the collection with PDA signing
    CreateV2CpiBuilder::new(mpl_core_program)
        .asset(asset)
        .collection(Some(collection))
        .authority(Some(authority))
        .payer(payer)
        .owner(Some(owner))
        .system_program(system_program)
        .name(name)
        .uri(uri)
        .data_state(DataState::AccountState)
        .invoke_signed(signer_seeds)?;

    Ok(())
}

pub mod state;
pub mod errors;
pub mod contexts;
pub mod events;

use state::{
    ContentType, hash_cid,
    MintConfig, PaymentCurrency,
    EcosystemConfig,
    ContentRewardPool, WalletContentState, NftRewardState, PRECISION,
    NFT_REWARD_STATE_SEED, ContentCollection, CONTENT_COLLECTION_SEED,
    RentConfig, RentEntry, RentTier, RENT_ENTRY_SEED,
};
use errors::ContentRegistryError;
use contexts::*;
use events::*;

declare_id!("3kLBPNtsBwqwb9xZRims2HC5uCeT6rUG9AqpKQfq2Vdn");

#[program]
pub mod content_registry {
    use super::*;

    // ============================================
    // ECOSYSTEM MANAGEMENT
    // ============================================

    /// Initialize the ecosystem config (admin only, once)
    pub fn initialize_ecosystem(
        ctx: Context<InitializeEcosystem>,
        usdc_mint: Pubkey,
    ) -> Result<()> {
        let ecosystem = &mut ctx.accounts.ecosystem_config;
        let timestamp = Clock::get()?.unix_timestamp;

        // Initialize ecosystem config
        ecosystem.admin = ctx.accounts.admin.key();
        ecosystem.treasury = ctx.accounts.treasury.key();
        ecosystem.usdc_mint = usdc_mint;
        ecosystem.total_fees_sol = 0;
        ecosystem.total_fees_usdc = 0;
        ecosystem.total_nfts_minted = 0;
        ecosystem.is_paused = false;
        ecosystem.created_at = timestamp;

        Ok(())
    }

    /// Update ecosystem settings (admin only)
    pub fn update_ecosystem(
        ctx: Context<UpdateEcosystem>,
        new_treasury: Option<Pubkey>,
        new_usdc_mint: Option<Pubkey>,
        is_paused: Option<bool>,
    ) -> Result<()> {
        let ecosystem = &mut ctx.accounts.ecosystem_config;

        if let Some(treasury) = new_treasury {
            ecosystem.treasury = treasury;
        }
        if let Some(usdc_mint) = new_usdc_mint {
            ecosystem.usdc_mint = usdc_mint;
        }
        if let Some(paused) = is_paused {
            ecosystem.is_paused = paused;
        }

        Ok(())
    }

    // ============================================
    // CONTENT MANAGEMENT
    // ============================================

    /// Register new content with CID uniqueness enforcement
    pub fn register_content(
        ctx: Context<RegisterContent>,
        cid_hash: [u8; 32],
        content_cid: String,
        metadata_cid: String,
        content_type: ContentType,
        is_encrypted: bool,
        preview_cid: String,
        encryption_meta_cid: String,
    ) -> Result<()> {
        require!(content_cid.len() <= 64, ContentRegistryError::CidTooLong);
        require!(metadata_cid.len() <= 64, ContentRegistryError::CidTooLong);
        require!(preview_cid.len() <= 64, ContentRegistryError::CidTooLong);
        require!(encryption_meta_cid.len() <= 64, ContentRegistryError::CidTooLong);

        // Verify the hash matches the CID
        let computed_hash = hash_cid(&content_cid);
        require!(computed_hash == cid_hash, ContentRegistryError::CidHashMismatch);

        let content = &mut ctx.accounts.content;
        let cid_registry = &mut ctx.accounts.cid_registry;
        let timestamp = Clock::get()?.unix_timestamp;

        // Initialize content entry
        content.creator = ctx.accounts.authority.key();
        content.content_cid = content_cid;
        content.metadata_cid = metadata_cid;
        content.content_type = content_type;
        content.tips_received = 0;
        content.created_at = timestamp;
        content.is_locked = false;
        content.minted_count = 0;
        content.is_encrypted = is_encrypted;
        content.preview_cid = preview_cid;
        content.encryption_meta_cid = encryption_meta_cid;

        // Initialize CID registry (ensures uniqueness)
        cid_registry.owner = ctx.accounts.authority.key();
        cid_registry.content_pda = content.key();
        cid_registry.registered_at = timestamp;

        Ok(())
    }

    /// Register new content with optional NFT mint configuration
    pub fn register_content_with_mint(
        ctx: Context<RegisterContentWithMint>,
        cid_hash: [u8; 32],
        content_cid: String,
        metadata_cid: String,
        content_type: ContentType,
        price: u64,
        max_supply: Option<u64>,
        creator_royalty_bps: u16,
        is_encrypted: bool,
        preview_cid: String,
        encryption_meta_cid: String,
    ) -> Result<()> {
        require!(content_cid.len() <= 64, ContentRegistryError::CidTooLong);
        require!(metadata_cid.len() <= 64, ContentRegistryError::CidTooLong);
        require!(preview_cid.len() <= 64, ContentRegistryError::CidTooLong);
        require!(encryption_meta_cid.len() <= 64, ContentRegistryError::CidTooLong);

        // Verify the hash matches the CID
        let computed_hash = hash_cid(&content_cid);
        require!(computed_hash == cid_hash, ContentRegistryError::CidHashMismatch);

        // Validate mint config (SOL only)
        require!(
            MintConfig::validate_price(price, PaymentCurrency::Sol),
            ContentRegistryError::PriceTooLow
        );
        require!(
            MintConfig::validate_royalty(creator_royalty_bps),
            ContentRegistryError::InvalidRoyalty
        );

        let content = &mut ctx.accounts.content;
        let cid_registry = &mut ctx.accounts.cid_registry;
        let mint_config = &mut ctx.accounts.mint_config;
        let timestamp = Clock::get()?.unix_timestamp;

        // Initialize content entry
        content.creator = ctx.accounts.authority.key();
        content.content_cid = content_cid;
        content.metadata_cid = metadata_cid;
        content.content_type = content_type;
        content.tips_received = 0;
        content.created_at = timestamp;
        content.is_locked = false;
        content.minted_count = 0;
        content.is_encrypted = is_encrypted;
        content.preview_cid = preview_cid;
        content.encryption_meta_cid = encryption_meta_cid;

        // Initialize CID registry (ensures uniqueness)
        cid_registry.owner = ctx.accounts.authority.key();
        cid_registry.content_pda = content.key();
        cid_registry.registered_at = timestamp;

        // Initialize mint config (SOL only)
        mint_config.content = content.key();
        mint_config.creator = ctx.accounts.authority.key();
        mint_config.price = price;
        mint_config.currency = PaymentCurrency::Sol;
        mint_config.max_supply = max_supply;
        mint_config.creator_royalty_bps = creator_royalty_bps;
        mint_config.is_active = true;
        mint_config.created_at = timestamp;
        mint_config.updated_at = timestamp;

        // Initialize content collection tracker
        let content_collection = &mut ctx.accounts.content_collection;
        content_collection.content = content.key();
        content_collection.collection_asset = ctx.accounts.collection_asset.key();
        content_collection.creator = ctx.accounts.authority.key();
        content_collection.created_at = timestamp;

        // Create Metaplex Core Collection for this content with Royalties plugin
        // NFT ownership is verified at claim time instead of using lifecycle hooks
        // Royalties are enforced on-chain via Metaplex Core plugin
        let collection_name = format!("Handcraft Collection");
        let collection_uri = format!("https://ipfs.filebase.io/ipfs/{}", content.metadata_cid);

        // Derive ContentRewardPool PDA for holder royalties
        let (holder_reward_pool, _) = Pubkey::find_program_address(
            &[b"content_reward_pool", content.key().as_ref()],
            ctx.program_id,
        );

        // Use content_collection PDA as update_authority so program can sign mints
        create_collection(
            &ctx.accounts.mpl_core_program.to_account_info(),
            &ctx.accounts.collection_asset.to_account_info(),
            &ctx.accounts.authority.to_account_info(),
            &ctx.accounts.content_collection.to_account_info(),
            &ctx.accounts.system_program.to_account_info(),
            collection_name,
            collection_uri,
            ctx.accounts.authority.key(),              // Creator receives creator royalties
            ctx.accounts.platform.key(),               // Platform receives 1%
            ctx.accounts.ecosystem_config.treasury,    // Ecosystem treasury receives 1%
            holder_reward_pool,                        // Holder reward pool receives 8%
            creator_royalty_bps,                       // Creator royalty percentage
        )?;

        Ok(())
    }

    /// Update content metadata (creator only, not locked)
    pub fn update_content(ctx: Context<UpdateContent>, metadata_cid: String) -> Result<()> {
        require!(metadata_cid.len() <= 64, ContentRegistryError::CidTooLong);

        let content = &mut ctx.accounts.content;
        require!(!content.is_locked, ContentRegistryError::ContentLocked);

        content.metadata_cid = metadata_cid;

        Ok(())
    }

    /// Delete content (creator only, not locked)
    pub fn delete_content(ctx: Context<DeleteContent>) -> Result<()> {
        let content = &ctx.accounts.content;
        require!(!content.is_locked, ContentRegistryError::ContentLocked);

        // Accounts will be closed by Anchor's close constraint
        Ok(())
    }

    /// Delete content with associated mint config (creator only, not locked)
    pub fn delete_content_with_mint(ctx: Context<DeleteContentWithMint>) -> Result<()> {
        let content = &ctx.accounts.content;
        require!(!content.is_locked, ContentRegistryError::ContentLocked);

        // Accounts will be closed by Anchor's close constraint
        Ok(())
    }

    /// Tip a creator for their content
    pub fn tip_content(ctx: Context<TipContent>, amount: u64) -> Result<()> {
        require!(amount > 0, ContentRegistryError::InvalidTipAmount);

        // Transfer SOL from tipper to creator
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.tipper.key(),
            &ctx.accounts.creator.key(),
            amount,
        );

        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.tipper.to_account_info(),
                ctx.accounts.creator.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Update content tips
        let content = &mut ctx.accounts.content;
        content.tips_received += amount;

        emit!(TipEvent {
            content: content.key(),
            tipper: ctx.accounts.tipper.key(),
            creator: ctx.accounts.creator.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // ============================================
    // MINT CONFIGURATION
    // ============================================

    /// Configure NFT minting for content (creator only, SOL only)
    pub fn configure_mint(
        ctx: Context<ConfigureMint>,
        price: u64,
        max_supply: Option<u64>,
        creator_royalty_bps: u16,
    ) -> Result<()> {
        // Validate price (SOL only)
        require!(
            MintConfig::validate_price(price, PaymentCurrency::Sol),
            ContentRegistryError::PriceTooLow
        );

        // Validate royalty
        require!(
            MintConfig::validate_royalty(creator_royalty_bps),
            ContentRegistryError::InvalidRoyalty
        );

        let mint_config = &mut ctx.accounts.mint_config;
        let timestamp = Clock::get()?.unix_timestamp;

        mint_config.content = ctx.accounts.content.key();
        mint_config.creator = ctx.accounts.creator.key();
        mint_config.price = price;
        mint_config.currency = PaymentCurrency::Sol;
        mint_config.max_supply = max_supply;
        mint_config.creator_royalty_bps = creator_royalty_bps;
        mint_config.is_active = true;
        mint_config.created_at = timestamp;
        mint_config.updated_at = timestamp;

        Ok(())
    }

    /// Update mint settings (creator only, with restrictions after first mint)
    pub fn update_mint_settings(
        ctx: Context<UpdateMintSettings>,
        price: Option<u64>,
        max_supply: Option<Option<u64>>,
        creator_royalty_bps: Option<u16>,
        is_active: Option<bool>,
    ) -> Result<()> {
        let content = &ctx.accounts.content;
        let mint_config = &mut ctx.accounts.mint_config;
        let timestamp = Clock::get()?.unix_timestamp;

        // Price can always be updated
        if let Some(new_price) = price {
            require!(
                MintConfig::validate_price(new_price, mint_config.currency),
                ContentRegistryError::PriceTooLow
            );
            mint_config.price = new_price;
        }

        // Max supply restrictions after minting starts
        if let Some(new_max_supply) = max_supply {
            if content.minted_count > 0 {
                // After first mint: can only decrease, not increase or set unlimited
                if let Some(new_max) = new_max_supply {
                    require!(
                        new_max >= content.minted_count,
                        ContentRegistryError::SupplyBelowMinted
                    );
                    if let Some(current_max) = mint_config.max_supply {
                        require!(
                            new_max <= current_max,
                            ContentRegistryError::CannotIncreaseSupply
                        );
                    } else {
                        // Currently unlimited, setting a cap is allowed
                    }
                } else {
                    // Trying to set unlimited after minting started - not allowed
                    return Err(ContentRegistryError::CannotIncreaseSupply.into());
                }
            }
            mint_config.max_supply = new_max_supply;
        }

        // Royalty cannot change after first mint
        if let Some(new_royalty) = creator_royalty_bps {
            require!(content.minted_count == 0, ContentRegistryError::ContentLocked);
            require!(
                MintConfig::validate_royalty(new_royalty),
                ContentRegistryError::InvalidRoyalty
            );
            mint_config.creator_royalty_bps = new_royalty;
        }

        // Active status can always be toggled
        if let Some(active) = is_active {
            mint_config.is_active = active;
        }

        mint_config.updated_at = timestamp;

        Ok(())
    }

    // ============================================
    // NFT MINTING (SOL PAYMENT ONLY)
    // ============================================

    /// Mint NFT with SOL payment
    /// Uses per-content reward pools with wallet-level tracking:
    /// - Each content has its own reward pool
    /// - 12% holder rewards go to that content's pool only
    /// - Wallet-level tracking allows batch claiming
    pub fn mint_nft_sol(ctx: Context<MintNftSol>) -> Result<()> {
        let ecosystem = &ctx.accounts.ecosystem_config;
        let mint_config = &ctx.accounts.mint_config;
        let content = &mut ctx.accounts.content;
        let content_reward_pool = &mut ctx.accounts.content_reward_pool;
        let buyer_wallet_state = &mut ctx.accounts.buyer_wallet_state;
        let timestamp = Clock::get()?.unix_timestamp;

        // Verify collection_asset matches what's stored in content_collection
        // We manually deserialize since we use AccountInfo to save stack space
        {
            let collection_data = ctx.accounts.content_collection.try_borrow_data()?;
            let content_collection: ContentCollection = ContentCollection::try_deserialize(
                &mut &collection_data[..]
            )?;
            require!(
                content_collection.collection_asset == ctx.accounts.collection_asset.key(),
                ContentRegistryError::ContentMismatch
            );
        }

        // Check ecosystem not paused
        require!(!ecosystem.is_paused, ContentRegistryError::EcosystemPaused);

        // Check minting is active and supply available
        require!(mint_config.is_active, ContentRegistryError::MintingNotActive);
        require!(
            mint_config.can_mint(content.minted_count),
            ContentRegistryError::MaxSupplyReached
        );

        // Verify SOL currency (only SOL supported now)
        require!(
            mint_config.currency == PaymentCurrency::Sol,
            ContentRegistryError::InvalidCurrency
        );

        let price = mint_config.price;
        let is_first_content_mint = content.minted_count == 0;
        let has_existing_nfts = content_reward_pool.total_nfts > 0;

        // Initialize content reward pool if this is the first mint for this content
        if content_reward_pool.content == Pubkey::default() {
            content_reward_pool.content = content.key();
            content_reward_pool.created_at = timestamp;
        }

        // Process payment if not free
        if price > 0 {
            let (creator_amount, platform_amount, ecosystem_amount, holder_reward_amount) =
                EcosystemConfig::calculate_primary_split(price);

            // For first NFT of this content, holder reward goes to creator (no holders yet)
            // Otherwise, holder reward goes to this content's reward pool
            let final_creator_amount = if !has_existing_nfts {
                creator_amount + holder_reward_amount
            } else {
                creator_amount
            };

            // Transfer to creator
            if final_creator_amount > 0 {
                let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.buyer.key(),
                    &ctx.accounts.creator.key(),
                    final_creator_amount,
                );
                anchor_lang::solana_program::program::invoke(
                    &transfer_ix,
                    &[
                        ctx.accounts.buyer.to_account_info(),
                        ctx.accounts.creator.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                )?;
            }

            // Transfer holder reward to content reward pool (if existing NFTs)
            // This increases reward_per_share for holders of THIS CONTENT only
            if has_existing_nfts && holder_reward_amount > 0 {
                let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.buyer.key(),
                    &content_reward_pool.to_account_info().key,
                    holder_reward_amount,
                );
                anchor_lang::solana_program::program::invoke(
                    &transfer_ix,
                    &[
                        ctx.accounts.buyer.to_account_info(),
                        content_reward_pool.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                )?;

                // Update reward_per_share BEFORE incrementing total_nfts
                // This ensures only existing holders benefit from this sale
                content_reward_pool.add_rewards(holder_reward_amount);
            }

            // Transfer to platform (if provided)
            if platform_amount > 0 {
                let platform_wallet = ctx.accounts.platform.as_ref()
                    .map(|p| p.key())
                    .unwrap_or(ecosystem.treasury);

                let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.buyer.key(),
                    &platform_wallet,
                    platform_amount,
                );
                anchor_lang::solana_program::program::invoke(
                    &transfer_ix,
                    &[
                        ctx.accounts.buyer.to_account_info(),
                        ctx.accounts.platform.as_ref()
                            .map(|p| p.to_account_info())
                            .unwrap_or(ctx.accounts.treasury.to_account_info()),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                )?;
            }

            // Transfer to ecosystem treasury
            if ecosystem_amount > 0 {
                let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.buyer.key(),
                    &ctx.accounts.treasury.key(),
                    ecosystem_amount,
                );
                anchor_lang::solana_program::program::invoke(
                    &transfer_ix,
                    &[
                        ctx.accounts.buyer.to_account_info(),
                        ctx.accounts.treasury.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                )?;
            }
        }

        // Initialize content reward pool if first mint
        if is_first_content_mint {
            content_reward_pool.content = content.key();
            content_reward_pool.reward_per_share = 0;
            content_reward_pool.total_nfts = 0;
            content_reward_pool.total_deposited = 0;
            content_reward_pool.total_claimed = 0;
            content_reward_pool.created_at = timestamp;

            // Lock content on first mint
            content.is_locked = true;
        }

        // Initialize or update buyer's wallet state for this content (for UI display)
        if buyer_wallet_state.nft_count == 0 {
            // First NFT for this wallet-content pair
            buyer_wallet_state.wallet = ctx.accounts.buyer.key();
            buyer_wallet_state.content = content.key();
            buyer_wallet_state.nft_count = 0;
            buyer_wallet_state.reward_debt = 0;
            buyer_wallet_state.created_at = timestamp;
            buyer_wallet_state.updated_at = timestamp;
        }

        // Add NFT to buyer's wallet state (for backwards compatibility / UI)
        buyer_wallet_state.add_nft(content_reward_pool.reward_per_share, timestamp);

        // Initialize per-NFT reward state - this is the source of truth for rewards
        // Account is created by Anchor's #[account(init)] constraint
        let nft_reward_state = &mut ctx.accounts.nft_reward_state;
        nft_reward_state.nft_asset = ctx.accounts.nft_asset.key();
        nft_reward_state.content = content.key();
        nft_reward_state.reward_debt = content_reward_pool.reward_per_share;
        nft_reward_state.created_at = timestamp;

        // Increment content's NFT count in the pool AFTER updating buyer state
        content_reward_pool.increment_nfts();

        // Increment content mint count
        content.minted_count += 1;

        // Update ecosystem stats
        let ecosystem_mut = &mut ctx.accounts.ecosystem_config;
        ecosystem_mut.total_nfts_minted += 1;
        if price > 0 {
            let (_, _, ecosystem_amount, _) = EcosystemConfig::calculate_primary_split(price);
            ecosystem_mut.total_fees_sol += ecosystem_amount;
        }

        // Create Metaplex Core NFT within the content's collection
        // NFT ownership is verified at claim time for reward distribution
        let nft_name = format!("Handcraft #{}", content.minted_count);
        let nft_uri = format!("https://ipfs.filebase.io/ipfs/{}", content.metadata_cid);

        // Derive content_collection PDA bump for signing
        let content_key = content.key();
        let (_, content_collection_bump) = Pubkey::find_program_address(
            &[CONTENT_COLLECTION_SEED, content_key.as_ref()],
            ctx.program_id,
        );
        let signer_seeds: &[&[&[u8]]] = &[&[
            CONTENT_COLLECTION_SEED,
            content_key.as_ref(),
            &[content_collection_bump],
        ]];

        create_core_nft(
            &ctx.accounts.mpl_core_program.to_account_info(),
            &ctx.accounts.nft_asset.to_account_info(),
            &ctx.accounts.collection_asset.to_account_info(),
            &ctx.accounts.content_collection.to_account_info(),
            &ctx.accounts.buyer.to_account_info(),
            &ctx.accounts.buyer.to_account_info(),
            &ctx.accounts.system_program.to_account_info(),
            nft_name,
            nft_uri,
            signer_seeds,
        )?;

        // Emit mint event
        emit!(NftMintEvent {
            content: content.key(),
            buyer: ctx.accounts.buyer.key(),
            creator: ctx.accounts.creator.key(),
            edition_number: content.minted_count,
            price,
            timestamp,
            nft_asset: ctx.accounts.nft_asset.key(),
        });

        Ok(())
    }

    // ============================================
    // HOLDER REWARD CLAIMS
    // ============================================

    /// Claim accumulated holder rewards for a single content
    /// Rewards = (nft_count * reward_per_share - reward_debt) / PRECISION
    pub fn claim_content_rewards(ctx: Context<ClaimContentRewards>) -> Result<()> {
        let content_reward_pool = &mut ctx.accounts.content_reward_pool;
        let wallet_state = &mut ctx.accounts.wallet_content_state;
        let timestamp = Clock::get()?.unix_timestamp;

        // Calculate pending rewards for this wallet's position in this content
        let pending = wallet_state.claim(content_reward_pool.reward_per_share, timestamp);

        require!(pending > 0, ContentRegistryError::NothingToClaim);

        // Transfer from content reward pool to holder
        **content_reward_pool.to_account_info().try_borrow_mut_lamports()? -= pending;
        **ctx.accounts.holder.to_account_info().try_borrow_mut_lamports()? += pending;

        // Update pool stats
        content_reward_pool.total_claimed += pending;

        // Emit claim event
        emit!(ClaimRewardEvent {
            holder: ctx.accounts.holder.key(),
            content: content_reward_pool.content,
            amount: pending,
            timestamp,
        });

        Ok(())
    }

    /// Claim rewards with on-chain NFT verification using per-NFT reward tracking
    /// This is the recommended claim method - it verifies actual NFT ownership at claim time
    /// and uses per-NFT reward_debt for fair distribution regardless of transfers
    ///
    /// Pass pairs of (nft_asset, nft_reward_state) as remaining_accounts:
    /// [nft_asset_1, nft_reward_state_1, nft_asset_2, nft_reward_state_2, ...]
    ///
    /// The instruction will:
    /// 1. Auto-sync any secondary sale royalties that arrived via Metaplex Royalties plugin
    /// 2. Verify each NFT belongs to the content's collection
    /// 3. Verify each NFT is owned by the claimer
    /// 4. Calculate rewards for each NFT: (reward_per_share - nft.reward_debt) / PRECISION
    /// 5. Update each NFT's reward_debt
    /// 6. Transfer total rewards to claimer
    pub fn claim_rewards_verified<'info>(
        ctx: Context<'_, '_, '_, 'info, ClaimRewardsVerified<'info>>,
    ) -> Result<()> {
        let content_reward_pool = &mut ctx.accounts.content_reward_pool;
        let wallet_state = &mut ctx.accounts.wallet_content_state;
        let content_collection = &ctx.accounts.content_collection;
        let timestamp = Clock::get()?.unix_timestamp;

        // Auto-sync secondary sale royalties before calculating rewards
        // This handles SOL that arrived from Metaplex Royalties plugin on secondary sales
        let rent = Rent::get()?;
        let pool_account_info = content_reward_pool.to_account_info();
        let current_lamports = pool_account_info.lamports();
        let rent_lamports = rent.minimum_balance(pool_account_info.data_len());

        let synced_amount = content_reward_pool.sync_secondary_royalties(current_lamports, rent_lamports);
        if synced_amount > 0 {
            emit!(SecondaryRoyaltySyncEvent {
                content: content_reward_pool.content,
                amount: synced_amount,
                new_reward_per_share: content_reward_pool.reward_per_share,
                timestamp,
            });
        }

        // Get the collection asset address from ContentCollection
        let collection_asset = content_collection.collection_asset;
        let content_key = content_reward_pool.content;
        let current_rps = content_reward_pool.reward_per_share;

        // Must have pairs of accounts (nft_asset, nft_reward_state)
        let remaining = &ctx.remaining_accounts;
        require!(remaining.len() % 2 == 0, ContentRegistryError::InvalidAccountPairs);

        let num_pairs = remaining.len() / 2;
        let mut total_pending: u64 = 0;
        let mut verified_count: u64 = 0;

        for i in 0..num_pairs {
            let nft_asset_info = &remaining[i * 2];
            let nft_reward_state_info = &remaining[i * 2 + 1];

            // Verify NFT ownership and collection membership
            if !verify_core_nft_ownership(
                nft_asset_info,
                &ctx.accounts.holder.key(),
                &collection_asset,
            )? {
                continue; // Skip NFTs not owned by claimer or not in collection
            }

            verified_count += 1;

            // Verify NftRewardState PDA
            let (expected_pda, _bump) = Pubkey::find_program_address(
                &[NFT_REWARD_STATE_SEED, nft_asset_info.key.as_ref()],
                ctx.program_id,
            );
            require!(
                nft_reward_state_info.key() == expected_pda,
                ContentRegistryError::InvalidNftRewardState
            );

            // Deserialize NftRewardState
            let nft_state_data = nft_reward_state_info.try_borrow_data()?;
            let nft_state: NftRewardState = NftRewardState::try_deserialize(
                &mut &nft_state_data[..]
            )?;

            // Verify NftRewardState belongs to this content
            require!(
                nft_state.content == content_key,
                ContentRegistryError::ContentMismatch
            );

            // Calculate pending for this NFT
            let nft_pending = if current_rps > nft_state.reward_debt {
                ((current_rps - nft_state.reward_debt) / PRECISION) as u64
            } else {
                0
            };

            total_pending += nft_pending;

            // Drop the borrow before mutating
            drop(nft_state_data);

            // Update NftRewardState's reward_debt
            {
                let mut nft_state_data = nft_reward_state_info.try_borrow_mut_data()?;
                let mut updated_state = NftRewardState::try_deserialize(
                    &mut &nft_state_data[..]
                )?;
                updated_state.reward_debt = current_rps;
                updated_state.try_serialize(&mut &mut nft_state_data[..])?;
            }
        }

        // Update wallet state for UI display (not used for reward calculation)
        wallet_state.nft_count = verified_count;
        wallet_state.reward_debt = verified_count as u128 * current_rps;
        wallet_state.updated_at = timestamp;

        // Transfer total pending rewards
        if total_pending > 0 {
            **content_reward_pool.to_account_info().try_borrow_mut_lamports()? -= total_pending;
            **ctx.accounts.holder.to_account_info().try_borrow_mut_lamports()? += total_pending;

            content_reward_pool.total_claimed += total_pending;

            emit!(ClaimRewardEvent {
                holder: ctx.accounts.holder.key(),
                content: content_key,
                amount: total_pending,
                timestamp,
            });
        }

        // Emit verification event
        emit!(VerifiedClaimEvent {
            holder: ctx.accounts.holder.key(),
            content: content_key,
            verified_nft_count: verified_count,
            stored_nft_count: wallet_state.nft_count,
            amount_claimed: total_pending,
            timestamp,
        });

        Ok(())
    }

    /// Batch claim rewards from multiple content pools
    /// Pass WalletContentState and ContentRewardPool pairs as remaining_accounts
    /// Order: [wallet_state_1, pool_1, wallet_state_2, pool_2, ...]
    pub fn claim_all_rewards(ctx: Context<ClaimAllRewards>) -> Result<()> {
        let holder = &ctx.accounts.holder;
        let remaining = &ctx.remaining_accounts;
        let timestamp = Clock::get()?.unix_timestamp;

        // Must have pairs of accounts (wallet_state, pool)
        require!(remaining.len() % 2 == 0, ContentRegistryError::InvalidAccountPairs);
        require!(remaining.len() > 0, ContentRegistryError::NothingToClaim);

        let mut total_claimed: u64 = 0;
        let num_pairs = remaining.len() / 2;

        for i in 0..num_pairs {
            let wallet_state_info = &remaining[i * 2];
            let pool_info = &remaining[i * 2 + 1];

            // Manually deserialize WalletContentState
            let wallet_state_data = wallet_state_info.try_borrow_data()?;
            let wallet_state: WalletContentState = WalletContentState::try_deserialize(
                &mut &wallet_state_data[..]
            )?;

            // Manually deserialize ContentRewardPool
            let pool_data = pool_info.try_borrow_data()?;
            let pool: ContentRewardPool = ContentRewardPool::try_deserialize(
                &mut &pool_data[..]
            )?;

            // Verify wallet state belongs to holder
            require!(wallet_state.wallet == holder.key(), ContentRegistryError::Unauthorized);

            // Verify wallet state and pool match
            require!(wallet_state.content == pool.content, ContentRegistryError::ContentMismatch);

            // Calculate pending rewards
            let pending = wallet_state.pending_reward(pool.reward_per_share);

            if pending > 0 {
                // Drop the borrows before mutating
                drop(wallet_state_data);
                drop(pool_data);

                // Update wallet state by re-borrowing and re-serializing
                {
                    let new_reward_debt = wallet_state.nft_count as u128 * pool.reward_per_share;
                    let mut wallet_state_data = wallet_state_info.try_borrow_mut_data()?;
                    let mut updated_wallet = WalletContentState::try_deserialize(
                        &mut &wallet_state_data[..]
                    )?;
                    updated_wallet.reward_debt = new_reward_debt;
                    updated_wallet.updated_at = timestamp;
                    updated_wallet.try_serialize(&mut &mut wallet_state_data[..])?;
                }

                // Update pool stats
                {
                    let new_total_claimed = pool.total_claimed + pending;
                    let mut pool_data = pool_info.try_borrow_mut_data()?;
                    let mut updated_pool = ContentRewardPool::try_deserialize(
                        &mut &pool_data[..]
                    )?;
                    updated_pool.total_claimed = new_total_claimed;
                    updated_pool.try_serialize(&mut &mut pool_data[..])?;
                }

                // Transfer from pool to holder
                **pool_info.try_borrow_mut_lamports()? -= pending;
                **holder.to_account_info().try_borrow_mut_lamports()? += pending;

                total_claimed += pending;

                emit!(ClaimRewardEvent {
                    holder: holder.key(),
                    content: pool.content,
                    amount: pending,
                    timestamp,
                });
            }
        }

        require!(total_claimed > 0, ContentRegistryError::NothingToClaim);

        emit!(BatchClaimEvent {
            holder: holder.key(),
            total_amount: total_claimed,
            num_contents: num_pairs as u32,
            timestamp,
        });

        Ok(())
    }

    // ============================================
    // NFT TRANSFER HOOK (Lifecycle Hook Handler)
    // ============================================

    /// Handle NFT transfer - called by Metaplex Core lifecycle hook
    /// This is NOT called via CPI from Metaplex - it's a separate instruction
    /// that must be called after the transfer to sync reward state.
    ///
    /// For now, we implement a manual sync approach where users call this
    /// after transferring NFTs to update their reward positions.
    pub fn sync_nft_transfer(ctx: Context<SyncNftTransfer>) -> Result<()> {
        let content_reward_pool = &mut ctx.accounts.content_reward_pool;
        let sender_state = &mut ctx.accounts.sender_wallet_state;
        let receiver_state = &mut ctx.accounts.receiver_wallet_state;
        let timestamp = Clock::get()?.unix_timestamp;

        // Verify sender actually had NFTs
        require!(sender_state.nft_count > 0, ContentRegistryError::SenderNotOwner);

        // Auto-claim sender's pending rewards before transfer
        let sender_pending = sender_state.pending_reward(content_reward_pool.reward_per_share);
        if sender_pending > 0 {
            // Transfer rewards from pool to sender
            **content_reward_pool.to_account_info().try_borrow_mut_lamports()? -= sender_pending;
            **ctx.accounts.sender.to_account_info().try_borrow_mut_lamports()? += sender_pending;
            content_reward_pool.total_claimed += sender_pending;

            emit!(ClaimRewardEvent {
                holder: ctx.accounts.sender.key(),
                content: content_reward_pool.content,
                amount: sender_pending,
                timestamp,
            });
        }

        // Remove NFT from sender's position
        sender_state.remove_nft(content_reward_pool.reward_per_share, timestamp);

        // Initialize receiver state if needed
        if receiver_state.nft_count == 0 && receiver_state.wallet == Pubkey::default() {
            receiver_state.wallet = ctx.accounts.receiver.key();
            receiver_state.content = content_reward_pool.content;
            receiver_state.created_at = timestamp;
        }

        // Add NFT to receiver's position
        receiver_state.add_nft(content_reward_pool.reward_per_share, timestamp);

        emit!(NftTransferSyncEvent {
            content: content_reward_pool.content,
            sender: ctx.accounts.sender.key(),
            receiver: ctx.accounts.receiver.key(),
            sender_claimed: sender_pending,
            timestamp,
        });

        Ok(())
    }

    /// Handle lifecycle hook callback from Metaplex Core
    /// Called automatically when NFTs with our hook are transferred
    /// This updates the wallet states for sender and receiver
    pub fn execute_lifecycle_hook(ctx: Context<ExecuteLifecycleHook>) -> Result<()> {
        let content_reward_pool = &mut ctx.accounts.content_reward_pool;
        let sender_state = &mut ctx.accounts.sender_wallet_state;
        let receiver_state = &mut ctx.accounts.receiver_wallet_state;
        let timestamp = Clock::get()?.unix_timestamp;

        let mut sender_claimed: u64 = 0;

        // If sender has NFTs, process the transfer
        if sender_state.nft_count > 0 {
            // Auto-claim sender's pending rewards
            let sender_pending = sender_state.pending_reward(content_reward_pool.reward_per_share);
            if sender_pending > 0 {
                **content_reward_pool.to_account_info().try_borrow_mut_lamports()? -= sender_pending;
                **ctx.accounts.sender.to_account_info().try_borrow_mut_lamports()? += sender_pending;
                content_reward_pool.total_claimed += sender_pending;
                sender_claimed = sender_pending;

                emit!(ClaimRewardEvent {
                    holder: ctx.accounts.sender.key(),
                    content: content_reward_pool.content,
                    amount: sender_pending,
                    timestamp,
                });
            }

            // Remove NFT from sender
            sender_state.remove_nft(content_reward_pool.reward_per_share, timestamp);
        }

        // Initialize receiver state if needed (for already-existing accounts)
        if receiver_state.wallet == Pubkey::default() {
            receiver_state.wallet = ctx.accounts.receiver.key();
            receiver_state.content = content_reward_pool.content;
            receiver_state.created_at = timestamp;
        }

        // Add NFT to receiver
        receiver_state.add_nft(content_reward_pool.reward_per_share, timestamp);

        emit!(NftTransferSyncEvent {
            content: content_reward_pool.content,
            sender: ctx.accounts.sender.key(),
            receiver: ctx.accounts.receiver.key(),
            sender_claimed,
            timestamp,
        });

        Ok(())
    }

    /// Batch sync multiple NFT transfers at once
    /// Useful when transferring multiple NFTs from same content
    pub fn sync_nft_transfers_batch(
        ctx: Context<SyncNftTransfersBatch>,
        count: u8,
    ) -> Result<()> {
        let content_reward_pool = &mut ctx.accounts.content_reward_pool;
        let sender_state = &mut ctx.accounts.sender_wallet_state;
        let receiver_state = &mut ctx.accounts.receiver_wallet_state;
        let timestamp = Clock::get()?.unix_timestamp;

        // Verify sender has enough NFTs
        require!(
            sender_state.nft_count >= count as u64,
            ContentRegistryError::SenderNotOwner
        );

        // Auto-claim sender's pending rewards before transfer
        let sender_pending = sender_state.pending_reward(content_reward_pool.reward_per_share);
        if sender_pending > 0 {
            **content_reward_pool.to_account_info().try_borrow_mut_lamports()? -= sender_pending;
            **ctx.accounts.sender.to_account_info().try_borrow_mut_lamports()? += sender_pending;
            content_reward_pool.total_claimed += sender_pending;

            emit!(ClaimRewardEvent {
                holder: ctx.accounts.sender.key(),
                content: content_reward_pool.content,
                amount: sender_pending,
                timestamp,
            });
        }

        // Remove NFTs from sender's position
        for _ in 0..count {
            sender_state.remove_nft(content_reward_pool.reward_per_share, timestamp);
        }

        // Initialize receiver state if needed
        if receiver_state.nft_count == 0 && receiver_state.wallet == Pubkey::default() {
            receiver_state.wallet = ctx.accounts.receiver.key();
            receiver_state.content = content_reward_pool.content;
            receiver_state.created_at = timestamp;
        }

        // Add NFTs to receiver's position
        for _ in 0..count {
            receiver_state.add_nft(content_reward_pool.reward_per_share, timestamp);
        }

        emit!(NftTransferSyncEvent {
            content: content_reward_pool.content,
            sender: ctx.accounts.sender.key(),
            receiver: ctx.accounts.receiver.key(),
            sender_claimed: sender_pending,
            timestamp,
        });

        Ok(())
    }

    // ============================================
    // CONTENT RENTAL
    // ============================================

    /// Configure rental settings for content (creator only)
    /// Sets the rent fee and rental period
    /// Configure rental with 3-tier pricing: 6 hours, 1 day, 7 days
    /// Creator must set fees for all three tiers
    pub fn configure_rent(
        ctx: Context<ConfigureRent>,
        rent_fee_6h: u64,
        rent_fee_1d: u64,
        rent_fee_7d: u64,
    ) -> Result<()> {
        // Validate all rent fees meet minimum
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

        let rent_config = &mut ctx.accounts.rent_config;
        let timestamp = Clock::get()?.unix_timestamp;

        rent_config.content = ctx.accounts.content.key();
        rent_config.creator = ctx.accounts.creator.key();
        rent_config.rent_fee_6h = rent_fee_6h;
        rent_config.rent_fee_1d = rent_fee_1d;
        rent_config.rent_fee_7d = rent_fee_7d;
        rent_config.is_active = true;
        rent_config.total_rentals = 0;
        rent_config.total_fees_collected = 0;
        rent_config.created_at = timestamp;
        rent_config.updated_at = timestamp;

        Ok(())
    }

    /// Update rental settings (creator only)
    /// Allows updating individual tier fees or all at once
    pub fn update_rent_config(
        ctx: Context<UpdateRentConfig>,
        rent_fee_6h: Option<u64>,
        rent_fee_1d: Option<u64>,
        rent_fee_7d: Option<u64>,
        is_active: Option<bool>,
    ) -> Result<()> {
        let rent_config = &mut ctx.accounts.rent_config;
        let timestamp = Clock::get()?.unix_timestamp;

        if let Some(fee) = rent_fee_6h {
            require!(
                RentConfig::validate_fee(fee),
                ContentRegistryError::RentFeeTooLow
            );
            rent_config.rent_fee_6h = fee;
        }

        if let Some(fee) = rent_fee_1d {
            require!(
                RentConfig::validate_fee(fee),
                ContentRegistryError::RentFeeTooLow
            );
            rent_config.rent_fee_1d = fee;
        }

        if let Some(fee) = rent_fee_7d {
            require!(
                RentConfig::validate_fee(fee),
                ContentRegistryError::RentFeeTooLow
            );
            rent_config.rent_fee_7d = fee;
        }

        if let Some(active) = is_active {
            rent_config.is_active = active;
        }

        rent_config.updated_at = timestamp;

        Ok(())
    }

    /// Rent content with SOL payment
    /// Creates a frozen (non-transferable) NFT that expires after the rental period
    /// User selects one of 3 tiers: 6 hours, 1 day, or 7 days
    /// Payment is distributed according to primary sale percentages
    pub fn rent_content_sol(ctx: Context<RentContentSol>, tier: RentTier) -> Result<()> {
        let ecosystem = &ctx.accounts.ecosystem_config;
        let rent_config = &ctx.accounts.rent_config;
        let content = &ctx.accounts.content;
        let content_reward_pool = &mut ctx.accounts.content_reward_pool;
        let timestamp = Clock::get()?.unix_timestamp;

        // Check ecosystem not paused
        require!(!ecosystem.is_paused, ContentRegistryError::EcosystemPaused);

        // Verify collection_asset matches what's stored in content_collection
        {
            let content_collection_info = ctx.accounts.content_collection.to_account_info();
            let collection_data = content_collection_info.try_borrow_data()?;
            let content_collection: ContentCollection = ContentCollection::try_deserialize(
                &mut &collection_data[..]
            )?;
            require!(
                content_collection.collection_asset == ctx.accounts.collection_asset.key(),
                ContentRegistryError::ContentMismatch
            );
        }

        // Verify creator matches content
        require!(
            content.creator == ctx.accounts.creator.key(),
            ContentRegistryError::Unauthorized
        );

        // Initialize content reward pool if this is the first rent/mint for this content
        if content_reward_pool.content == Pubkey::default() {
            content_reward_pool.content = content.key();
            content_reward_pool.created_at = timestamp;
        }

        // Get fee and period based on selected tier
        let rent_fee = rent_config.get_fee_for_tier(tier);
        let rent_period = tier.period_seconds();
        let expires_at = timestamp + rent_period;
        let has_existing_nfts = content_reward_pool.total_nfts > 0;

        // Process payment using primary sale distribution
        if rent_fee > 0 {
            let (creator_amount, platform_amount, ecosystem_amount, holder_reward_amount) =
                EcosystemConfig::calculate_primary_split(rent_fee);

            // For rentals, if no existing NFTs, holder reward goes to creator
            let final_creator_amount = if !has_existing_nfts {
                creator_amount + holder_reward_amount
            } else {
                creator_amount
            };

            // Transfer to creator
            if final_creator_amount > 0 {
                let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.renter.key(),
                    &ctx.accounts.creator.key(),
                    final_creator_amount,
                );
                anchor_lang::solana_program::program::invoke(
                    &transfer_ix,
                    &[
                        ctx.accounts.renter.to_account_info(),
                        ctx.accounts.creator.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                )?;
            }

            // Transfer holder reward to content reward pool (if existing NFTs)
            if has_existing_nfts && holder_reward_amount > 0 {
                let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.renter.key(),
                    &content_reward_pool.to_account_info().key,
                    holder_reward_amount,
                );
                anchor_lang::solana_program::program::invoke(
                    &transfer_ix,
                    &[
                        ctx.accounts.renter.to_account_info(),
                        content_reward_pool.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                )?;

                // Update reward_per_share for existing holders
                content_reward_pool.add_rewards(holder_reward_amount);
            }

            // Transfer to platform
            if platform_amount > 0 {
                let platform_wallet = ctx.accounts.platform.as_ref()
                    .map(|p| p.key())
                    .unwrap_or(ecosystem.treasury);

                let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.renter.key(),
                    &platform_wallet,
                    platform_amount,
                );
                anchor_lang::solana_program::program::invoke(
                    &transfer_ix,
                    &[
                        ctx.accounts.renter.to_account_info(),
                        ctx.accounts.platform.as_ref()
                            .map(|p| p.to_account_info())
                            .unwrap_or(ctx.accounts.treasury.to_account_info()),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                )?;
            }

            // Transfer to ecosystem treasury
            if ecosystem_amount > 0 {
                let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.renter.key(),
                    &ctx.accounts.treasury.key(),
                    ecosystem_amount,
                );
                anchor_lang::solana_program::program::invoke(
                    &transfer_ix,
                    &[
                        ctx.accounts.renter.to_account_info(),
                        ctx.accounts.treasury.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                )?;
            }
        }

        // Create RentEntry PDA to track this rental
        let nft_asset_key = ctx.accounts.nft_asset.key();
        let (rent_entry_pda, rent_entry_bump) = Pubkey::find_program_address(
            &[RENT_ENTRY_SEED, nft_asset_key.as_ref()],
            ctx.program_id,
        );
        require!(
            ctx.accounts.rent_entry.key() == rent_entry_pda,
            ContentRegistryError::InvalidRentEntry
        );

        // Create the RentEntry account
        let space = 8 + RentEntry::INIT_SPACE;
        let rent = Rent::get()?;
        let lamports = rent.minimum_balance(space);

        let seeds: &[&[u8]] = &[RENT_ENTRY_SEED, nft_asset_key.as_ref(), &[rent_entry_bump]];
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
            let discriminator = RentEntry::DISCRIMINATOR;
            data[0..8].copy_from_slice(&discriminator);

            // Write renter (32 bytes)
            data[8..40].copy_from_slice(&ctx.accounts.renter.key().to_bytes());
            // Write content (32 bytes)
            data[40..72].copy_from_slice(&content.key().to_bytes());
            // Write nft_asset (32 bytes)
            data[72..104].copy_from_slice(&nft_asset_key.to_bytes());
            // Write rented_at (8 bytes)
            data[104..112].copy_from_slice(&timestamp.to_le_bytes());
            // Write expires_at (8 bytes)
            data[112..120].copy_from_slice(&expires_at.to_le_bytes());
            // Write is_active (1 byte)
            data[120] = 1; // true
            // Write fee_paid (8 bytes)
            data[121..129].copy_from_slice(&rent_fee.to_le_bytes());
        }

        // Create frozen rental NFT (non-transferable to prevent resale of expired rentals)
        let rental_nft_name = format!("Rental Access #{}", rent_config.total_rentals + 1);
        let rental_nft_uri = format!("https://ipfs.filebase.io/ipfs/{}", content.metadata_cid);

        // Derive content_collection PDA for signing
        let content_key = content.key();
        let (_, content_collection_bump) = Pubkey::find_program_address(
            &[CONTENT_COLLECTION_SEED, content_key.as_ref()],
            ctx.program_id,
        );

        let signer_seeds: &[&[&[u8]]] = &[&[
            CONTENT_COLLECTION_SEED,
            content_key.as_ref(),
            &[content_collection_bump],
        ]];

        // Step 1: Create rental NFT within the content's collection (no plugins yet)
        create_core_nft(
            &ctx.accounts.mpl_core_program.to_account_info(),
            &ctx.accounts.nft_asset.to_account_info(),
            &ctx.accounts.collection_asset.to_account_info(),
            &ctx.accounts.content_collection.to_account_info(),
            &ctx.accounts.renter.to_account_info(),
            &ctx.accounts.renter.to_account_info(),
            &ctx.accounts.system_program.to_account_info(),
            rental_nft_name,
            rental_nft_uri,
            signer_seeds,
        )?;

        // Step 2: Add FreezeDelegate plugin and freeze it
        // Owner (renter) must be the authority to add plugins to their own asset
        AddPluginV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
            .asset(&ctx.accounts.nft_asset.to_account_info())
            .collection(Some(&ctx.accounts.collection_asset.to_account_info()))
            .payer(&ctx.accounts.renter.to_account_info())
            .authority(Some(&ctx.accounts.renter.to_account_info()))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: true }))
            .init_authority(PluginAuthority::None)  // No one can unfreeze - permanently frozen
            .invoke()?;

        // Update rent config stats (manual update to avoid borrow issues)
        {
            let rent_config_info = ctx.accounts.rent_config.to_account_info();
            let mut rent_config_data = rent_config_info.try_borrow_mut_data()?;
            let mut updated_config = RentConfig::try_deserialize(&mut &rent_config_data[..])?;
            updated_config.total_rentals += 1;
            updated_config.total_fees_collected += rent_fee;
            updated_config.updated_at = timestamp;
            updated_config.try_serialize(&mut &mut rent_config_data[..])?;
        }

        // Emit rental event
        emit!(ContentRentedEvent {
            content: content.key(),
            renter: ctx.accounts.renter.key(),
            creator: ctx.accounts.creator.key(),
            nft_asset: nft_asset_key,
            fee_paid: rent_fee,
            rented_at: timestamp,
            expires_at,
        });

        Ok(())
    }

    /// Check if a rental has expired
    /// Returns the rental status (can be used for access control)
    pub fn check_rent_expiry(ctx: Context<CheckRentExpiry>) -> Result<()> {
        let rent_entry = &ctx.accounts.rent_entry;
        let timestamp = Clock::get()?.unix_timestamp;

        if rent_entry.is_expired(timestamp) {
            msg!("Rental expired at {}, current time {}", rent_entry.expires_at, timestamp);
            return Err(ContentRegistryError::RentalExpired.into());
        }

        msg!("Rental valid until {}, remaining {} seconds",
            rent_entry.expires_at,
            rent_entry.remaining_time(timestamp)
        );

        Ok(())
    }
}

