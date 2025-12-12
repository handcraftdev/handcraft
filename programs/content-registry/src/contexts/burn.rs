use anchor_lang::prelude::*;
use mpl_core::instructions::BurnV1CpiBuilder;
use crate::state::*;
use crate::state::reward_pool::PRECISION;
use crate::errors::ContentRegistryError;
use crate::MPL_CORE_ID;

/// Burn an NFT with proper reward state cleanup
/// - Verifies NFT ownership and collection membership
/// - Decrements totalWeight and totalNfts in ContentRewardPool
/// - Closes NftRewardState account (refunds rent to owner)
/// - Burns the NFT via Metaplex Core CPI (signed by content_collection PDA)
#[derive(Accounts)]
pub struct BurnNft<'info> {
    /// The content entry this NFT belongs to
    pub content: Account<'info, ContentEntry>,

    /// ContentCollection PDA - holds collection info and is the burn delegate authority
    #[account(
        seeds = [CONTENT_COLLECTION_SEED, content.key().as_ref()],
        bump,
        constraint = content_collection.collection_asset == collection_asset.key() @ ContentRegistryError::ContentMismatch
    )]
    pub content_collection: Account<'info, ContentCollection>,

    /// The content's reward pool - needs to decrement totalWeight and totalNfts
    #[account(
        mut,
        seeds = [CONTENT_REWARD_POOL_SEED, content.key().as_ref()],
        bump
    )]
    pub content_reward_pool: Account<'info, ContentRewardPool>,

    /// Unified NFT reward state - will be closed and rent refunded to owner
    #[account(
        mut,
        seeds = [UNIFIED_NFT_REWARD_STATE_SEED, nft_asset.key().as_ref()],
        bump,
        constraint = nft_reward_state.content_or_bundle == content.key() @ ContentRegistryError::ContentMismatch,
        constraint = !nft_reward_state.is_bundle @ ContentRegistryError::ContentMismatch,
        close = owner  // Refund rent to owner when closing
    )]
    pub nft_reward_state: Account<'info, UnifiedNftRewardState>,

    /// The NFT asset to burn (Metaplex Core asset)
    /// CHECK: Verified by Metaplex Core program
    #[account(mut)]
    pub nft_asset: AccountInfo<'info>,

    /// The collection the NFT belongs to
    /// CHECK: Verified by Metaplex Core program
    #[account(mut)]
    pub collection_asset: AccountInfo<'info>,

    /// The NFT owner who is burning (also receives rent refund from NftRewardState)
    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Burn NFT with atomic reward state cleanup
/// Auto-claims any pending rewards before burning
pub fn handle_burn_nft(ctx: Context<BurnNft>) -> Result<()> {
    let content_reward_pool = &mut ctx.accounts.content_reward_pool;
    let nft_reward_state = &ctx.accounts.nft_reward_state;

    // Get the weight of the NFT being burned (default to 100 if legacy)
    let weight = if nft_reward_state.weight == 0 { 100u16 } else { nft_reward_state.weight };

    // Auto-claim pending rewards before burning
    // Pending = (weight * reward_per_share - content_or_bundle_debt) / PRECISION
    let current_rps = content_reward_pool.reward_per_share;
    let weighted_rps = (weight as u128) * current_rps;
    let pending = if weighted_rps > nft_reward_state.content_or_bundle_debt {
        ((weighted_rps - nft_reward_state.content_or_bundle_debt) / PRECISION) as u64
    } else {
        0
    };

    if pending > 0 {
        // Transfer pending rewards from pool to owner
        **content_reward_pool.to_account_info().try_borrow_mut_lamports()? -= pending;
        **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += pending;
        content_reward_pool.total_claimed += pending;

        msg!("Auto-claimed {} lamports before burn", pending);
    }

    // Decrement totalNfts and totalWeight in the pool
    if content_reward_pool.total_nfts > 0 {
        content_reward_pool.total_nfts -= 1;
    }
    if content_reward_pool.total_weight >= weight as u64 {
        content_reward_pool.total_weight -= weight as u64;
    }

    msg!("Reward pool updated: totalNfts={}, totalWeight={}",
         content_reward_pool.total_nfts,
         content_reward_pool.total_weight);

    // Derive content_collection PDA bump for signing
    let content_key = ctx.accounts.content.key();
    let (_, content_collection_bump) = Pubkey::find_program_address(
        &[CONTENT_COLLECTION_SEED, content_key.as_ref()],
        ctx.program_id,
    );
    let signer_seeds: &[&[&[u8]]] = &[&[
        CONTENT_COLLECTION_SEED,
        content_key.as_ref(),
        &[content_collection_bump],
    ]];

    // Burn NFT via Metaplex Core CPI
    // content_collection PDA signs as the PermanentBurnDelegate authority
    BurnV1CpiBuilder::new(&ctx.accounts.mpl_core_program)
        .asset(&ctx.accounts.nft_asset)
        .collection(Some(&ctx.accounts.collection_asset))
        .payer(&ctx.accounts.owner)
        .authority(Some(&ctx.accounts.content_collection.to_account_info()))
        .invoke_signed(signer_seeds)?;

    msg!("NFT burned successfully, NftRewardState closed");

    // NftRewardState account is closed by Anchor's close constraint
    // Rent is refunded to owner

    Ok(())
}
