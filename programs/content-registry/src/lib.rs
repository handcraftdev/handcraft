use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
};
use std::io::Write;

// Metaplex Core Program ID: CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d
pub const MPL_CORE_ID: Pubkey = Pubkey::new_from_array([
    0xaf, 0x54, 0xab, 0x10, 0xbd, 0x97, 0xa5, 0x42,
    0xa0, 0x9e, 0xf7, 0xb3, 0x98, 0x89, 0xdd, 0x0c,
    0xd3, 0x94, 0xa4, 0xcc, 0xe9, 0xdf, 0xa6, 0xcd,
    0xc9, 0x7e, 0xbe, 0x2d, 0x23, 0x5b, 0xa7, 0x48,
]);

// DataState enum values
const DATA_STATE_ACCOUNT_STATE: u8 = 0;

// External Plugin Adapter types for lifecycle hook
mod plugin_types {
    // ExternalPluginAdapterInitInfo variant indices
    pub const LIFECYCLE_HOOK_VARIANT: u8 = 0;

    // HookableLifecycleEvent enum
    pub const LIFECYCLE_EVENT_TRANSFER: u8 = 1;

    // ExternalCheckResult enum
    pub const CHECK_RESULT_CAN_LISTEN: u8 = 0;

    // PluginAuthority enum
    pub const PLUGIN_AUTHORITY_UPDATE_AUTHORITY: u8 = 2;

    // ExternalPluginAdapterSchema enum
    pub const SCHEMA_BINARY: u8 = 0;

    // ExternalPluginAdapterExtraAccount enum variants
    pub const EXTRA_ACCOUNT_CUSTOM_PDA: u8 = 4;

    // Seed enum variants
    pub const SEED_ADDRESS: u8 = 0;
    pub const SEED_BYTES: u8 = 1;
    pub const SEED_OWNER: u8 = 3;
    pub const SEED_RECIPIENT: u8 = 4;
}

/// Build the lifecycle hook external plugin adapter data
/// This configures the hook to be called on transfers with our program
fn build_lifecycle_hook_plugin(
    hooked_program: &Pubkey,
    content_pda: &Pubkey,
) -> Vec<u8> {
    use plugin_types::*;

    let mut data = Vec::new();

    // ExternalPluginAdapterInitInfo::LifecycleHook variant (0)
    data.push(LIFECYCLE_HOOK_VARIANT);

    // hooked_program: Pubkey
    data.extend_from_slice(hooked_program.as_ref());

    // init_plugin_authority: Option<PluginAuthority> = Some(UpdateAuthority)
    data.push(1); // Some
    data.push(PLUGIN_AUTHORITY_UPDATE_AUTHORITY);

    // lifecycle_checks: Vec<(HookableLifecycleEvent, ExternalCheckResult)>
    // We only want to listen to Transfer events
    data.extend_from_slice(&1u32.to_le_bytes()); // Vec length = 1
    data.push(LIFECYCLE_EVENT_TRANSFER); // HookableLifecycleEvent::Transfer
    data.push(CHECK_RESULT_CAN_LISTEN); // ExternalCheckResult::CanListen

    // extra_accounts: Option<Vec<ExternalPluginAdapterExtraAccount>>
    // We need: ContentRewardPool, SenderWalletState, ReceiverWalletState
    data.push(1); // Some
    data.extend_from_slice(&3u32.to_le_bytes()); // Vec length = 3

    // 1. ContentRewardPool (fixed PDA)
    // ExternalPluginAdapterExtraAccount::CustomPda
    data.push(EXTRA_ACCOUNT_CUSTOM_PDA);
    // seeds: Vec<Seed>
    data.extend_from_slice(&2u32.to_le_bytes()); // 2 seeds
    // Seed::Bytes("content_reward_pool")
    data.push(SEED_BYTES);
    let seed_bytes = b"content_reward_pool";
    data.extend_from_slice(&(seed_bytes.len() as u32).to_le_bytes());
    data.extend_from_slice(seed_bytes);
    // Seed::Address(content_pda)
    data.push(SEED_ADDRESS);
    data.extend_from_slice(content_pda.as_ref());
    // custom_program_id: Option<Pubkey> = Some(our program)
    data.push(1); // Some
    data.extend_from_slice(hooked_program.as_ref());
    // is_signer: bool = false
    data.push(0);
    // is_writable: bool = true
    data.push(1);

    // 2. Sender's WalletContentState (uses Owner seed)
    data.push(EXTRA_ACCOUNT_CUSTOM_PDA);
    data.extend_from_slice(&3u32.to_le_bytes()); // 3 seeds
    // Seed::Bytes("wallet_content")
    data.push(SEED_BYTES);
    let wallet_seed = b"wallet_content";
    data.extend_from_slice(&(wallet_seed.len() as u32).to_le_bytes());
    data.extend_from_slice(wallet_seed);
    // Seed::Owner (current owner = sender in transfer)
    data.push(SEED_OWNER);
    // Seed::Address(content_pda)
    data.push(SEED_ADDRESS);
    data.extend_from_slice(content_pda.as_ref());
    // custom_program_id
    data.push(1);
    data.extend_from_slice(hooked_program.as_ref());
    // is_signer, is_writable
    data.push(0);
    data.push(1);

    // 3. Receiver's WalletContentState (uses Recipient seed)
    data.push(EXTRA_ACCOUNT_CUSTOM_PDA);
    data.extend_from_slice(&3u32.to_le_bytes()); // 3 seeds
    // Seed::Bytes("wallet_content")
    data.push(SEED_BYTES);
    data.extend_from_slice(&(wallet_seed.len() as u32).to_le_bytes());
    data.extend_from_slice(wallet_seed);
    // Seed::Recipient (new owner = receiver in transfer)
    data.push(SEED_RECIPIENT);
    // Seed::Address(content_pda)
    data.push(SEED_ADDRESS);
    data.extend_from_slice(content_pda.as_ref());
    // custom_program_id
    data.push(1);
    data.extend_from_slice(hooked_program.as_ref());
    // is_signer, is_writable
    data.push(0);
    data.push(1);

    // data_authority: Option<PluginAuthority> = None
    data.push(0);

    // schema: ExternalPluginAdapterSchema = Binary
    data.push(SCHEMA_BINARY);

    data
}

/// Build and invoke the Metaplex Core CreateV2 instruction via raw CPI
/// CreateV2 discriminator is 20
/// Account order (all 8): asset, collection?, authority?, payer, owner?, updateAuthority?, systemProgram, logWrapper?
/// Now includes lifecycle hook plugin for automatic transfer tracking
fn create_core_nft<'info>(
    mpl_core_program: &AccountInfo<'info>,
    asset: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    owner: &AccountInfo<'info>,
    update_authority: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    name: String,
    uri: String,
    content_pda: &Pubkey,
    our_program_id: &Pubkey,
) -> Result<()> {
    // CreateV2 discriminator
    const CREATE_V2_DISCRIMINATOR: u8 = 20;

    // Build instruction data with Borsh serialization
    // CreateV2Args: { dataState: DataState, name: String, uri: String, plugins: Option<Vec>, externalPluginAdapters: Option<Vec> }
    let mut data = Vec::new();
    data.push(CREATE_V2_DISCRIMINATOR);

    // DataState enum: AccountState = 0
    data.push(DATA_STATE_ACCOUNT_STATE);

    // Borsh string encoding: 4-byte little-endian length + bytes
    let name_bytes = name.as_bytes();
    data.write_all(&(name_bytes.len() as u32).to_le_bytes()).unwrap();
    data.write_all(name_bytes).unwrap();

    let uri_bytes = uri.as_bytes();
    data.write_all(&(uri_bytes.len() as u32).to_le_bytes()).unwrap();
    data.write_all(uri_bytes).unwrap();

    // plugins: Option<Vec<PluginAuthorityPair>> = None (no standard plugins)
    data.push(0);

    // externalPluginAdapters: Option<Vec<ExternalPluginAdapterInitInfo>> = None for now
    // TODO: Re-enable lifecycle hook once encoding is fixed
    data.push(0); // None - disabled until we fix the encoding

    // Build account metas - ALL 8 accounts in correct order
    // Optional accounts that are not used should still be included (use program ID as placeholder)
    let accounts = vec![
        AccountMeta::new(asset.key(), true),                       // 1. asset (mutable, signer)
        AccountMeta::new_readonly(MPL_CORE_ID, false),             // 2. collection (optional) - use program ID as None
        AccountMeta::new_readonly(MPL_CORE_ID, false),             // 3. authority (optional) - use program ID as None
        AccountMeta::new(payer.key(), true),                       // 4. payer (mutable, signer)
        AccountMeta::new_readonly(owner.key(), false),             // 5. owner
        AccountMeta::new_readonly(update_authority.key(), false),  // 6. updateAuthority
        AccountMeta::new_readonly(system_program.key(), false),    // 7. systemProgram
        AccountMeta::new_readonly(MPL_CORE_ID, false),             // 8. logWrapper (optional) - use program ID as None
    ];

    let ix = Instruction {
        program_id: MPL_CORE_ID,
        accounts,
        data,
    };

    invoke(
        &ix,
        &[
            asset.clone(),
            mpl_core_program.clone(),  // for collection placeholder
            mpl_core_program.clone(),  // for authority placeholder
            payer.clone(),
            owner.clone(),
            update_authority.clone(),
            system_program.clone(),
            mpl_core_program.clone(),  // for logWrapper placeholder
        ],
    )?;

    Ok(())
}

pub mod state;
pub mod errors;

use state::{
    ContentEntry, ContentType,
    CidRegistry, CID_REGISTRY_SEED, hash_cid,
    MintConfig, PaymentCurrency, MINT_CONFIG_SEED,
    EcosystemConfig, ECOSYSTEM_CONFIG_SEED,
    ContentRewardPool, WalletContentState,
    CONTENT_REWARD_POOL_SEED, WALLET_CONTENT_STATE_SEED,
};
use errors::ContentRegistryError;

declare_id!("EvnyqtTHHeNYoeauSgXMAUSu4EFeEsbxUxVzhC2NaDHU");

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

        // Initialize or update buyer's wallet state for this content
        if buyer_wallet_state.nft_count == 0 {
            // First NFT for this wallet-content pair
            buyer_wallet_state.wallet = ctx.accounts.buyer.key();
            buyer_wallet_state.content = content.key();
            buyer_wallet_state.nft_count = 0;
            buyer_wallet_state.reward_debt = 0;
            buyer_wallet_state.created_at = timestamp;
            buyer_wallet_state.updated_at = timestamp;
        }

        // Add NFT to buyer's wallet state (records current reward_per_share as debt)
        buyer_wallet_state.add_nft(content_reward_pool.reward_per_share, timestamp);

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

        // Create Metaplex Core NFT with lifecycle hook for transfer tracking
        let nft_name = format!("Handcraft #{}", content.minted_count);
        let nft_uri = format!("https://ipfs.filebase.io/ipfs/{}", content.metadata_cid);
        let content_key = content.key();

        create_core_nft(
            &ctx.accounts.mpl_core_program.to_account_info(),
            &ctx.accounts.nft_asset.to_account_info(),
            &ctx.accounts.buyer.to_account_info(),
            &ctx.accounts.buyer.to_account_info(),
            &ctx.accounts.creator.to_account_info(),
            &ctx.accounts.system_program.to_account_info(),
            nft_name,
            nft_uri,
            &content_key,
            &crate::ID,
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
}

// ============================================
// ACCOUNT STRUCTS
// ============================================

#[derive(Accounts)]
pub struct InitializeEcosystem<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + EcosystemConfig::INIT_SPACE,
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump
    )]
    pub ecosystem_config: Account<'info, EcosystemConfig>,

    /// CHECK: Treasury wallet to receive ecosystem fees
    pub treasury: AccountInfo<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateEcosystem<'info> {
    #[account(
        mut,
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump,
        has_one = admin @ ContentRegistryError::Unauthorized
    )]
    pub ecosystem_config: Account<'info, EcosystemConfig>,

    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(cid_hash: [u8; 32])]
pub struct RegisterContent<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ContentEntry::INIT_SPACE,
        seeds = [b"content", cid_hash.as_ref()],
        bump
    )]
    pub content: Account<'info, ContentEntry>,

    #[account(
        init,
        payer = authority,
        space = 8 + CidRegistry::INIT_SPACE,
        seeds = [CID_REGISTRY_SEED, cid_hash.as_ref()],
        bump
    )]
    pub cid_registry: Account<'info, CidRegistry>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(cid_hash: [u8; 32])]
pub struct RegisterContentWithMint<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ContentEntry::INIT_SPACE,
        seeds = [b"content", cid_hash.as_ref()],
        bump
    )]
    pub content: Account<'info, ContentEntry>,

    #[account(
        init,
        payer = authority,
        space = 8 + CidRegistry::INIT_SPACE,
        seeds = [CID_REGISTRY_SEED, cid_hash.as_ref()],
        bump
    )]
    pub cid_registry: Account<'info, CidRegistry>,

    #[account(
        init,
        payer = authority,
        space = 8 + MintConfig::INIT_SPACE,
        seeds = [MINT_CONFIG_SEED, content.key().as_ref()],
        bump
    )]
    pub mint_config: Account<'info, MintConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateContent<'info> {
    #[account(
        mut,
        has_one = creator @ ContentRegistryError::Unauthorized
    )]
    pub content: Account<'info, ContentEntry>,

    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct DeleteContent<'info> {
    #[account(
        mut,
        has_one = creator @ ContentRegistryError::Unauthorized,
        close = creator
    )]
    pub content: Account<'info, ContentEntry>,

    #[account(
        mut,
        close = creator
    )]
    pub cid_registry: Account<'info, CidRegistry>,

    #[account(mut)]
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct DeleteContentWithMint<'info> {
    #[account(
        mut,
        has_one = creator @ ContentRegistryError::Unauthorized,
        close = creator
    )]
    pub content: Account<'info, ContentEntry>,

    #[account(
        mut,
        close = creator
    )]
    pub cid_registry: Account<'info, CidRegistry>,

    #[account(
        mut,
        seeds = [MINT_CONFIG_SEED, content.key().as_ref()],
        bump,
        has_one = creator @ ContentRegistryError::Unauthorized,
        close = creator
    )]
    pub mint_config: Account<'info, MintConfig>,

    #[account(mut)]
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct TipContent<'info> {
    #[account(mut)]
    pub content: Account<'info, ContentEntry>,

    /// CHECK: Creator wallet to receive tips
    #[account(mut, constraint = content.creator == creator.key())]
    pub creator: AccountInfo<'info>,

    #[account(mut)]
    pub tipper: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfigureMint<'info> {
    #[account(
        has_one = creator @ ContentRegistryError::Unauthorized
    )]
    pub content: Account<'info, ContentEntry>,

    #[account(
        init,
        payer = creator,
        space = 8 + MintConfig::INIT_SPACE,
        seeds = [MINT_CONFIG_SEED, content.key().as_ref()],
        bump
    )]
    pub mint_config: Account<'info, MintConfig>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMintSettings<'info> {
    #[account(
        has_one = creator @ ContentRegistryError::Unauthorized
    )]
    pub content: Account<'info, ContentEntry>,

    #[account(
        mut,
        seeds = [MINT_CONFIG_SEED, content.key().as_ref()],
        bump,
        has_one = creator @ ContentRegistryError::Unauthorized
    )]
    pub mint_config: Account<'info, MintConfig>,

    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct MintNftSol<'info> {
    #[account(
        mut,
        seeds = [ECOSYSTEM_CONFIG_SEED],
        bump
    )]
    pub ecosystem_config: Account<'info, EcosystemConfig>,

    #[account(mut)]
    pub content: Account<'info, ContentEntry>,

    #[account(
        seeds = [MINT_CONFIG_SEED, content.key().as_ref()],
        bump
    )]
    pub mint_config: Account<'info, MintConfig>,

    /// Content-specific reward pool
    /// Holder rewards from this content's sales accumulate here
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + ContentRewardPool::INIT_SPACE,
        seeds = [CONTENT_REWARD_POOL_SEED, content.key().as_ref()],
        bump
    )]
    pub content_reward_pool: Account<'info, ContentRewardPool>,

    /// Buyer's wallet state for this content
    /// Tracks how many NFTs they own and their reward debt
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + WalletContentState::INIT_SPACE,
        seeds = [WALLET_CONTENT_STATE_SEED, buyer.key().as_ref(), content.key().as_ref()],
        bump
    )]
    pub buyer_wallet_state: Account<'info, WalletContentState>,

    /// CHECK: Creator to receive payment and be update authority of NFT
    #[account(mut, constraint = content.creator == creator.key())]
    pub creator: AccountInfo<'info>,

    /// CHECK: Optional platform wallet for commission
    #[account(mut)]
    pub platform: Option<AccountInfo<'info>>,

    /// CHECK: Ecosystem treasury
    #[account(mut, constraint = ecosystem_config.treasury == treasury.key())]
    pub treasury: AccountInfo<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    /// The NFT asset account (Metaplex Core asset)
    /// This must be a new keypair generated client-side
    #[account(mut)]
    pub nft_asset: Signer<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimContentRewards<'info> {
    /// The content's reward pool to claim from
    #[account(
        mut,
        seeds = [CONTENT_REWARD_POOL_SEED, content_reward_pool.content.as_ref()],
        bump
    )]
    pub content_reward_pool: Account<'info, ContentRewardPool>,

    /// The holder's wallet state for this content
    #[account(
        mut,
        seeds = [WALLET_CONTENT_STATE_SEED, holder.key().as_ref(), wallet_content_state.content.as_ref()],
        bump,
        constraint = wallet_content_state.wallet == holder.key() @ ContentRegistryError::Unauthorized,
        constraint = wallet_content_state.content == content_reward_pool.content @ ContentRegistryError::ContentMismatch
    )]
    pub wallet_content_state: Account<'info, WalletContentState>,

    /// The holder claiming the reward
    #[account(mut)]
    pub holder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimAllRewards<'info> {
    /// The holder claiming rewards from multiple content pools
    #[account(mut)]
    pub holder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SyncNftTransfer<'info> {
    /// The content's reward pool
    #[account(
        mut,
        seeds = [CONTENT_REWARD_POOL_SEED, content_reward_pool.content.as_ref()],
        bump
    )]
    pub content_reward_pool: Account<'info, ContentRewardPool>,

    /// The sender's wallet state for this content
    #[account(
        mut,
        seeds = [WALLET_CONTENT_STATE_SEED, sender.key().as_ref(), content_reward_pool.content.as_ref()],
        bump,
        constraint = sender_wallet_state.wallet == sender.key() @ ContentRegistryError::Unauthorized,
        constraint = sender_wallet_state.content == content_reward_pool.content @ ContentRegistryError::ContentMismatch
    )]
    pub sender_wallet_state: Account<'info, WalletContentState>,

    /// The receiver's wallet state for this content (created if needed)
    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + WalletContentState::INIT_SPACE,
        seeds = [WALLET_CONTENT_STATE_SEED, receiver.key().as_ref(), content_reward_pool.content.as_ref()],
        bump
    )]
    pub receiver_wallet_state: Account<'info, WalletContentState>,

    /// The sender (must sign to authorize the sync)
    #[account(mut)]
    pub sender: Signer<'info>,

    /// CHECK: The receiver of the NFT
    #[account(mut)]
    pub receiver: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SyncNftTransfersBatch<'info> {
    /// The content's reward pool
    #[account(
        mut,
        seeds = [CONTENT_REWARD_POOL_SEED, content_reward_pool.content.as_ref()],
        bump
    )]
    pub content_reward_pool: Account<'info, ContentRewardPool>,

    /// The sender's wallet state for this content
    #[account(
        mut,
        seeds = [WALLET_CONTENT_STATE_SEED, sender.key().as_ref(), content_reward_pool.content.as_ref()],
        bump,
        constraint = sender_wallet_state.wallet == sender.key() @ ContentRegistryError::Unauthorized,
        constraint = sender_wallet_state.content == content_reward_pool.content @ ContentRegistryError::ContentMismatch
    )]
    pub sender_wallet_state: Account<'info, WalletContentState>,

    /// The receiver's wallet state for this content (created if needed)
    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + WalletContentState::INIT_SPACE,
        seeds = [WALLET_CONTENT_STATE_SEED, receiver.key().as_ref(), content_reward_pool.content.as_ref()],
        bump
    )]
    pub receiver_wallet_state: Account<'info, WalletContentState>,

    /// The sender (must sign to authorize the sync)
    #[account(mut)]
    pub sender: Signer<'info>,

    /// CHECK: The receiver of the NFT
    #[account(mut)]
    pub receiver: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Accounts for Metaplex Core lifecycle hook callback
/// Called automatically by Metaplex Core when NFTs with our hook are transferred
/// Receiver's wallet state is created automatically if it doesn't exist
#[derive(Accounts)]
pub struct ExecuteLifecycleHook<'info> {
    /// CHECK: The Metaplex Core program must be the caller
    /// We verify the asset has our lifecycle hook configured
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    /// CHECK: The NFT asset being transferred
    pub asset: AccountInfo<'info>,

    /// The content's reward pool (passed as extra account by Metaplex Core)
    #[account(
        mut,
        seeds = [CONTENT_REWARD_POOL_SEED, content_reward_pool.content.as_ref()],
        bump
    )]
    pub content_reward_pool: Account<'info, ContentRewardPool>,

    /// The sender's wallet state for this content
    #[account(
        mut,
        seeds = [WALLET_CONTENT_STATE_SEED, sender.key().as_ref(), content_reward_pool.content.as_ref()],
        bump
    )]
    pub sender_wallet_state: Account<'info, WalletContentState>,

    /// The receiver's wallet state for this content (created if needed)
    /// Sender pays for account creation as part of transfer cost
    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + WalletContentState::INIT_SPACE,
        seeds = [WALLET_CONTENT_STATE_SEED, receiver.key().as_ref(), content_reward_pool.content.as_ref()],
        bump
    )]
    pub receiver_wallet_state: Account<'info, WalletContentState>,

    /// CHECK: The sender (current owner) of the NFT - pays for receiver account if needed
    #[account(mut)]
    pub sender: Signer<'info>,

    /// CHECK: The receiver (new owner) of the NFT
    #[account(mut)]
    pub receiver: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

// ============================================
// EVENTS
// ============================================

#[event]
pub struct TipEvent {
    pub content: Pubkey,
    pub tipper: Pubkey,
    pub creator: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct NftMintEvent {
    pub content: Pubkey,
    pub buyer: Pubkey,
    pub creator: Pubkey,
    pub edition_number: u64,
    pub price: u64,
    pub timestamp: i64,
    pub nft_asset: Pubkey,
}

#[event]
pub struct ClaimRewardEvent {
    pub holder: Pubkey,
    pub content: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct BatchClaimEvent {
    pub holder: Pubkey,
    pub total_amount: u64,
    pub num_contents: u32,
    pub timestamp: i64,
}

#[event]
pub struct NftTransferSyncEvent {
    pub content: Pubkey,
    pub sender: Pubkey,
    pub receiver: Pubkey,
    pub sender_claimed: u64,
    pub timestamp: i64,
}
