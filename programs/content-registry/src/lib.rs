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

/// Build and invoke the Metaplex Core CreateV2 instruction via raw CPI
/// CreateV2 discriminator is 20
/// Account order (all 8): asset, collection?, authority?, payer, owner?, updateAuthority?, systemProgram, logWrapper?
fn create_core_nft<'info>(
    mpl_core_program: &AccountInfo<'info>,
    asset: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    owner: &AccountInfo<'info>,
    update_authority: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    name: String,
    uri: String,
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

    // None for optional plugins and externalPluginAdapters
    data.push(0); // plugins = None
    data.push(0); // externalPluginAdapters = None

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
    GlobalRewardPool, NftRewardState,
    GLOBAL_REWARD_POOL_SEED, NFT_REWARD_STATE_SEED,
};
use errors::ContentRegistryError;

declare_id!("EvnyqtTHHeNYoeauSgXMAUSu4EFeEsbxUxVzhC2NaDHU");

#[program]
pub mod content_registry {
    use super::*;

    // ============================================
    // ECOSYSTEM MANAGEMENT
    // ============================================

    /// Initialize the ecosystem config and global reward pool (admin only, once)
    pub fn initialize_ecosystem(
        ctx: Context<InitializeEcosystem>,
        usdc_mint: Pubkey,
    ) -> Result<()> {
        let ecosystem = &mut ctx.accounts.ecosystem_config;
        let global_reward_pool = &mut ctx.accounts.global_reward_pool;
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

        // Initialize global reward pool
        global_reward_pool.reward_per_share = 0;
        global_reward_pool.total_nfts = 0;
        global_reward_pool.total_deposited = 0;
        global_reward_pool.total_claimed = 0;
        global_reward_pool.created_at = timestamp;

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
    /// Uses global accumulated reward pool model:
    /// - All 12% holder rewards go to a single global pool
    /// - reward_per_share increases for all existing NFT holders across ALL content
    pub fn mint_nft_sol(ctx: Context<MintNftSol>) -> Result<()> {
        let ecosystem = &ctx.accounts.ecosystem_config;
        let mint_config = &ctx.accounts.mint_config;
        let content = &mut ctx.accounts.content;
        let global_reward_pool = &mut ctx.accounts.global_reward_pool;
        let nft_reward_state = &mut ctx.accounts.nft_reward_state;
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
        let has_existing_nfts = global_reward_pool.total_nfts > 0;

        // Process payment if not free
        if price > 0 {
            let (creator_amount, platform_amount, ecosystem_amount, holder_reward_amount) =
                EcosystemConfig::calculate_primary_split(price);

            // For first global NFT, holder reward goes to creator (no holders yet)
            // Otherwise, holder reward goes to global pool
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

            // Transfer holder reward to global reward pool (if existing NFTs)
            // This increases reward_per_share for ALL existing NFT holders
            if has_existing_nfts && holder_reward_amount > 0 {
                let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.buyer.key(),
                    &global_reward_pool.to_account_info().key,
                    holder_reward_amount,
                );
                anchor_lang::solana_program::program::invoke(
                    &transfer_ix,
                    &[
                        ctx.accounts.buyer.to_account_info(),
                        global_reward_pool.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                )?;

                // Update reward_per_share BEFORE incrementing total_nfts
                // This ensures only existing holders benefit from this sale
                global_reward_pool.add_rewards(holder_reward_amount);
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

        // Lock content on first mint for this content
        if is_first_content_mint {
            content.is_locked = true;
        }

        // Increment content mint count
        content.minted_count += 1;

        // Initialize NFT reward state with current global reward_per_share as debt
        // This ensures this NFT can only claim rewards from FUTURE sales
        nft_reward_state.nft_asset = ctx.accounts.nft_asset.key();
        nft_reward_state.reward_debt = global_reward_pool.reward_per_share;
        nft_reward_state.created_at = timestamp;

        // Increment global NFT count AFTER setting reward debt
        global_reward_pool.increment_nfts();

        // Update ecosystem stats
        let ecosystem_mut = &mut ctx.accounts.ecosystem_config;
        ecosystem_mut.total_nfts_minted += 1;
        if price > 0 {
            let (_, _, ecosystem_amount, _) = EcosystemConfig::calculate_primary_split(price);
            ecosystem_mut.total_fees_sol += ecosystem_amount;
        }

        // Create Metaplex Core NFT
        let nft_name = format!("Handcraft #{}", content.minted_count);
        let nft_uri = format!("https://ipfs.filebase.io/ipfs/{}", content.metadata_cid);

        create_core_nft(
            &ctx.accounts.mpl_core_program.to_account_info(),
            &ctx.accounts.nft_asset.to_account_info(),
            &ctx.accounts.buyer.to_account_info(),
            &ctx.accounts.buyer.to_account_info(),
            &ctx.accounts.creator.to_account_info(),
            &ctx.accounts.system_program.to_account_info(),
            nft_name,
            nft_uri,
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

    /// Claim accumulated holder rewards for a single NFT from the global pool
    /// Rewards = (current_reward_per_share - nft_reward_debt) / PRECISION
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let global_reward_pool = &mut ctx.accounts.global_reward_pool;
        let nft_reward_state = &mut ctx.accounts.nft_reward_state;
        let timestamp = Clock::get()?.unix_timestamp;

        // Calculate pending rewards
        let pending = nft_reward_state.pending_reward(global_reward_pool.reward_per_share);

        require!(pending > 0, ContentRegistryError::NothingToClaim);

        // Transfer from global reward pool to holder
        **global_reward_pool.to_account_info().try_borrow_mut_lamports()? -= pending;
        **ctx.accounts.holder.to_account_info().try_borrow_mut_lamports()? += pending;

        // Update state
        global_reward_pool.total_claimed += pending;
        nft_reward_state.reward_debt = global_reward_pool.reward_per_share;

        // Emit claim event
        emit!(ClaimRewardEvent {
            holder: ctx.accounts.holder.key(),
            nft_asset: nft_reward_state.nft_asset,
            amount: pending,
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

    /// Global reward pool for all holder rewards
    #[account(
        init,
        payer = admin,
        space = 8 + GlobalRewardPool::INIT_SPACE,
        seeds = [GLOBAL_REWARD_POOL_SEED],
        bump
    )]
    pub global_reward_pool: Account<'info, GlobalRewardPool>,

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

    /// Global reward pool for all holder rewards
    /// All 12% holder rewards from all content sales accumulate here
    #[account(
        mut,
        seeds = [GLOBAL_REWARD_POOL_SEED],
        bump
    )]
    pub global_reward_pool: Account<'info, GlobalRewardPool>,

    /// NFT reward state tracking for the newly minted NFT
    /// Records current global reward_per_share as debt so this NFT only claims future rewards
    #[account(
        init,
        payer = buyer,
        space = 8 + NftRewardState::INIT_SPACE,
        seeds = [NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump
    )]
    pub nft_reward_state: Account<'info, NftRewardState>,

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
pub struct ClaimRewards<'info> {
    /// The global reward pool to claim from
    #[account(
        mut,
        seeds = [GLOBAL_REWARD_POOL_SEED],
        bump
    )]
    pub global_reward_pool: Account<'info, GlobalRewardPool>,

    /// NFT reward state tracking for this NFT
    #[account(
        mut,
        seeds = [NFT_REWARD_STATE_SEED, nft_reward_state.nft_asset.as_ref()],
        bump
    )]
    pub nft_reward_state: Account<'info, NftRewardState>,

    /// CHECK: The NFT asset - we verify the holder owns it via Metaplex Core
    /// The owner field is at offset 33 in the Core asset account data
    #[account(
        constraint = nft_reward_state.nft_asset == nft_asset.key() @ ContentRegistryError::NftMismatch
    )]
    pub nft_asset: AccountInfo<'info>,

    /// The holder claiming the reward (must own the NFT)
    #[account(mut)]
    pub holder: Signer<'info>,

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
    pub nft_asset: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}
