use anchor_lang::prelude::*;
use mpl_core::instructions::UpdateCollectionV1CpiBuilder;
use crate::state::*;
use crate::errors::ContentRegistryError;
use crate::MPL_CORE_ID;

/// Update collection metadata (name and/or URI)
/// Only allowed before any NFTs are minted (is_locked = false)
///
/// For Content: validates against ContentEntry
/// For Bundle: validates against Bundle
#[derive(Accounts)]
pub struct UpdateMetadata<'info> {
    /// The mint config that controls the collection
    /// Also serves as update authority for the Metaplex Core collection
    #[account(
        seeds = [MINT_CONFIG_SEED, mint_config.item.as_ref()],
        bump,
        constraint = mint_config.creator == creator.key() @ ContentRegistryError::Unauthorized,
    )]
    pub mint_config: Account<'info, MintConfig>,

    /// The Metaplex Core Collection asset to update
    /// Must match collection_asset stored in the content/bundle
    /// CHECK: Validated by matching against the item's collection_asset
    #[account(mut)]
    pub collection_asset: AccountInfo<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    /// The creator who owns this content/bundle
    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Update content collection metadata
#[derive(Accounts)]
pub struct UpdateContentMetadata<'info> {
    #[account(
        constraint = content.creator == creator.key() @ ContentRegistryError::Unauthorized,
        constraint = !content.is_locked @ ContentRegistryError::ContentLocked,
        constraint = content.collection_asset == collection_asset.key() @ ContentRegistryError::InvalidCollection,
    )]
    pub content: Account<'info, ContentEntry>,

    #[account(
        seeds = [MINT_CONFIG_SEED, content.key().as_ref()],
        bump,
    )]
    pub mint_config: Account<'info, MintConfig>,

    /// CHECK: Collection asset validated by constraint
    #[account(mut)]
    pub collection_asset: AccountInfo<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Update bundle collection metadata
#[derive(Accounts)]
pub struct UpdateBundleMetadata<'info> {
    #[account(
        constraint = bundle.creator == creator.key() @ ContentRegistryError::Unauthorized,
        constraint = !bundle.is_locked @ ContentRegistryError::ContentLocked,
        constraint = bundle.collection_asset == collection_asset.key() @ ContentRegistryError::InvalidCollection,
    )]
    pub bundle: Account<'info, Bundle>,

    #[account(
        seeds = [MINT_CONFIG_SEED, bundle.key().as_ref()],
        bump,
    )]
    pub mint_config: Account<'info, MintConfig>,

    /// CHECK: Collection asset validated by constraint
    #[account(mut)]
    pub collection_asset: AccountInfo<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Update content collection URI (metadata CID)
pub fn update_content_metadata_handler(
    ctx: Context<UpdateContentMetadata>,
    new_metadata_cid: String,
) -> Result<()> {
    let content = &ctx.accounts.content;
    let mint_config = &ctx.accounts.mint_config;

    // Build the new URI from the CID
    let new_uri = format!("https://ipfs.filebase.io/ipfs/{}", new_metadata_cid);

    // Get mint_config seeds for signing
    let content_key = content.key();
    let mint_config_seeds = &[
        MINT_CONFIG_SEED,
        content_key.as_ref(),
        &[ctx.bumps.mint_config],
    ];

    // CPI to Metaplex Core UpdateCollectionV1
    UpdateCollectionV1CpiBuilder::new(&ctx.accounts.mpl_core_program)
        .collection(&ctx.accounts.collection_asset)
        .payer(&ctx.accounts.creator)
        .authority(Some(&mint_config.to_account_info()))
        .system_program(&ctx.accounts.system_program.to_account_info())
        .new_uri(new_uri)
        .invoke_signed(&[mint_config_seeds])?;

    msg!("Updated content collection metadata to CID: {}", new_metadata_cid);

    Ok(())
}

/// Update bundle collection URI (metadata CID)
pub fn update_bundle_metadata_handler(
    ctx: Context<UpdateBundleMetadata>,
    new_metadata_cid: String,
) -> Result<()> {
    let bundle = &ctx.accounts.bundle;
    let mint_config = &ctx.accounts.mint_config;

    // Build the new URI from the CID
    let new_uri = format!("https://ipfs.filebase.io/ipfs/{}", new_metadata_cid);

    // Get mint_config seeds for signing
    let bundle_key = bundle.key();
    let mint_config_seeds = &[
        MINT_CONFIG_SEED,
        bundle_key.as_ref(),
        &[ctx.bumps.mint_config],
    ];

    // CPI to Metaplex Core UpdateCollectionV1
    UpdateCollectionV1CpiBuilder::new(&ctx.accounts.mpl_core_program)
        .collection(&ctx.accounts.collection_asset)
        .payer(&ctx.accounts.creator)
        .authority(Some(&mint_config.to_account_info()))
        .system_program(&ctx.accounts.system_program.to_account_info())
        .new_uri(new_uri)
        .invoke_signed(&[mint_config_seeds])?;

    msg!("Updated bundle collection metadata to CID: {}", new_metadata_cid);

    Ok(())
}
