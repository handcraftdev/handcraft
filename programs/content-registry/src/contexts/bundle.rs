use anchor_lang::prelude::*;
use crate::state::{
    Bundle, BundleItem, BundleType, ContentEntry,
    BUNDLE_SEED, BUNDLE_ITEM_SEED, MAX_BUNDLE_ITEMS,
};
use crate::errors::ContentRegistryError;

/// Create a new bundle
#[derive(Accounts)]
#[instruction(bundle_id: String, metadata_cid: String)]
pub struct CreateBundle<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = Bundle::space(),
        seeds = [BUNDLE_SEED, creator.key().as_ref(), bundle_id.as_bytes()],
        bump
    )]
    pub bundle: Account<'info, Bundle>,

    pub system_program: Program<'info, System>,
}

/// Add content to a bundle (only allowed for unpublished bundles)
#[derive(Accounts)]
pub struct AddBundleItem<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        has_one = creator,
        constraint = !bundle.is_locked @ ContentRegistryError::BundleLocked
    )]
    pub bundle: Account<'info, Bundle>,

    /// The content to add to the bundle
    #[account(
        constraint = content.creator == creator.key() @ ContentRegistryError::NotContentCreator
    )]
    pub content: Account<'info, ContentEntry>,

    #[account(
        init,
        payer = creator,
        space = BundleItem::space(),
        seeds = [BUNDLE_ITEM_SEED, bundle.key().as_ref(), content.key().as_ref()],
        bump
    )]
    pub bundle_item: Account<'info, BundleItem>,

    pub system_program: Program<'info, System>,
}

/// Remove content from a bundle (only allowed for unpublished bundles)
#[derive(Accounts)]
pub struct RemoveBundleItem<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        has_one = creator,
        constraint = !bundle.is_locked @ ContentRegistryError::BundleLocked
    )]
    pub bundle: Account<'info, Bundle>,

    #[account(
        mut,
        has_one = bundle,
        close = creator
    )]
    pub bundle_item: Account<'info, BundleItem>,
}

/// Update bundle metadata
#[derive(Accounts)]
pub struct UpdateBundle<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        has_one = creator
    )]
    pub bundle: Account<'info, Bundle>,
}

/// Delete a bundle (only if empty)
#[derive(Accounts)]
pub struct DeleteBundle<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        has_one = creator,
        constraint = bundle.item_count == 0 @ ContentRegistryError::BundleNotEmpty,
        close = creator
    )]
    pub bundle: Account<'info, Bundle>,
}

// ========== HANDLER IMPLEMENTATIONS ==========

pub fn handle_create_bundle(
    ctx: Context<CreateBundle>,
    bundle_id: String,
    bundle_type: BundleType,
    visibility_level: Option<u8>,
) -> Result<()> {
    let bundle = &mut ctx.accounts.bundle;
    let clock = Clock::get()?;

    // Validate visibility level (0-3)
    let vis_level = visibility_level.unwrap_or(1); // Default to Level 1 (Ecosystem)
    require!(vis_level <= 3, ContentRegistryError::InvalidVisibilityLevel);

    bundle.creator = ctx.accounts.creator.key();
    bundle.bundle_id = bundle_id;
    bundle.collection_asset = Pubkey::default(); // Set when mint is configured
    bundle.bundle_type = bundle_type;
    bundle.item_count = 0;
    bundle.is_active = false; // Start as draft (unpublished)
    bundle.is_locked = false;
    bundle.minted_count = 0;
    bundle.pending_count = 0;
    bundle.visibility_level = vis_level;
    bundle.created_at = clock.unix_timestamp;
    bundle.updated_at = clock.unix_timestamp;

    msg!("Bundle created as draft: {} (type: {:?}, visibility: {})", bundle.bundle_id, bundle.bundle_type, vis_level);

    Ok(())
}

pub fn handle_add_bundle_item(
    ctx: Context<AddBundleItem>,
    position: Option<u16>,
) -> Result<()> {
    let bundle = &mut ctx.accounts.bundle;
    let bundle_item = &mut ctx.accounts.bundle_item;
    let clock = Clock::get()?;

    // Check max items
    require!(
        bundle.item_count < MAX_BUNDLE_ITEMS,
        ContentRegistryError::BundleItemLimitReached
    );

    // Use provided position or append at end
    let item_position = position.unwrap_or(bundle.item_count);

    bundle_item.bundle = bundle.key();
    bundle_item.content = ctx.accounts.content.key();
    bundle_item.position = item_position;
    bundle_item.added_at = clock.unix_timestamp;

    bundle.item_count = bundle.item_count.checked_add(1).unwrap();
    bundle.updated_at = clock.unix_timestamp;

    msg!(
        "Added content to bundle at position {}. Total items: {}",
        item_position,
        bundle.item_count
    );

    Ok(())
}

pub fn handle_remove_bundle_item(ctx: Context<RemoveBundleItem>) -> Result<()> {
    let bundle = &mut ctx.accounts.bundle;
    let clock = Clock::get()?;

    bundle.item_count = bundle.item_count.saturating_sub(1);
    bundle.updated_at = clock.unix_timestamp;

    msg!("Removed item from bundle. Remaining items: {}", bundle.item_count);

    Ok(())
}

pub fn handle_update_bundle(
    ctx: Context<UpdateBundle>,
    is_active: Option<bool>,
) -> Result<()> {
    let bundle = &mut ctx.accounts.bundle;
    let clock = Clock::get()?;

    if let Some(active) = is_active {
        bundle.is_active = active;
    }

    // NOTE: visibility_level is immutable - set only at creation time
    // This is consistent with content visibility behavior

    bundle.updated_at = clock.unix_timestamp;

    msg!("Bundle updated: {}", bundle.bundle_id);

    Ok(())
}

pub fn handle_delete_bundle(_ctx: Context<DeleteBundle>) -> Result<()> {
    msg!("Bundle deleted");
    Ok(())
}
