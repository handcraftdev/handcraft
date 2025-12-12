use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ContentRegistryError;

// ============================================================================
// INITIALIZE PATRON CONFIG (Creator sets up subscription tiers)
// ============================================================================

/// Initialize patron configuration for a creator
/// Allows creators to set membership (support-only) and subscription (support + access) prices
#[derive(Accounts)]
pub struct InitPatronConfig<'info> {
    /// Creator's patron configuration (to be created)
    #[account(
        init,
        payer = creator,
        space = 8 + CreatorPatronConfig::INIT_SPACE,
        seeds = [CREATOR_PATRON_CONFIG_SEED, creator.key().as_ref()],
        bump
    )]
    pub patron_config: Account<'info, CreatorPatronConfig>,

    /// Creator's patron pool - receives 12% of patron subscription fees
    #[account(
        init_if_needed,
        payer = creator,
        space = 8 + CreatorPatronPool::INIT_SPACE,
        seeds = [CREATOR_PATRON_POOL_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_patron_pool: Account<'info, CreatorPatronPool>,

    /// The creator setting up patron tiers
    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Initialize patron config with membership and/or subscription tiers
pub fn handle_init_patron_config(
    ctx: Context<InitPatronConfig>,
    membership_price: u64,
    subscription_price: u64,
) -> Result<()> {
    let timestamp = Clock::get()?.unix_timestamp;

    // At least one tier must be enabled
    require!(
        membership_price > 0 || subscription_price > 0,
        ContentRegistryError::InvalidPatronConfig
    );

    // Initialize patron config
    let config = &mut ctx.accounts.patron_config;
    config.creator = ctx.accounts.creator.key();
    config.membership_price = membership_price;
    config.subscription_price = subscription_price;
    config.is_active = true;
    config.created_at = timestamp;
    config.updated_at = timestamp;

    // Initialize patron pool if this is the first time
    let pool = &mut ctx.accounts.creator_patron_pool;
    if pool.created_at == 0 {
        pool.creator = ctx.accounts.creator.key();
        pool.reward_per_share = 0;
        pool.total_weight = 0;
        pool.total_deposited = 0;
        pool.total_claimed = 0;
        pool.last_distribution_at = timestamp;
        pool.epoch_duration = DEFAULT_EPOCH_DURATION;
        pool.created_at = timestamp;
    }

    msg!("Patron config initialized for creator: {}", ctx.accounts.creator.key());
    msg!("  Membership price: {} lamports", membership_price);
    msg!("  Subscription price: {} lamports", subscription_price);

    Ok(())
}

// ============================================================================
// UPDATE PATRON CONFIG (Creator updates subscription tiers)
// ============================================================================

/// Update patron configuration
#[derive(Accounts)]
pub struct UpdatePatronConfig<'info> {
    /// Creator's patron configuration
    #[account(
        mut,
        seeds = [CREATOR_PATRON_CONFIG_SEED, creator.key().as_ref()],
        bump,
        constraint = patron_config.creator == creator.key() @ ContentRegistryError::Unauthorized
    )]
    pub patron_config: Account<'info, CreatorPatronConfig>,

    /// The creator who owns the config
    pub creator: Signer<'info>,
}

/// Update patron config prices or active status
pub fn handle_update_patron_config(
    ctx: Context<UpdatePatronConfig>,
    membership_price: Option<u64>,
    subscription_price: Option<u64>,
    is_active: Option<bool>,
) -> Result<()> {
    let timestamp = Clock::get()?.unix_timestamp;
    let config = &mut ctx.accounts.patron_config;

    if let Some(price) = membership_price {
        config.membership_price = price;
    }

    if let Some(price) = subscription_price {
        config.subscription_price = price;
    }

    if let Some(active) = is_active {
        config.is_active = active;
    }

    // Validate at least one tier is enabled if active
    if config.is_active {
        require!(
            config.membership_price > 0 || config.subscription_price > 0,
            ContentRegistryError::InvalidPatronConfig
        );
    }

    config.updated_at = timestamp;

    msg!("Patron config updated for creator: {}", ctx.accounts.creator.key());

    Ok(())
}

// ============================================================================
// SUBSCRIBE TO CREATOR (SOL direct payment - simplified version)
// ============================================================================

/// Subscribe to a creator (epoch-based lazy distribution)
/// Payment goes to streaming treasury, distributed on epoch end (triggered by mint or claim)
#[derive(Accounts)]
pub struct SubscribePatron<'info> {
    /// Creator's patron configuration
    #[account(
        seeds = [CREATOR_PATRON_CONFIG_SEED, creator.key().as_ref()],
        bump,
        constraint = patron_config.is_active @ ContentRegistryError::PatronConfigInactive
    )]
    pub patron_config: Account<'info, CreatorPatronConfig>,

    /// Creator's patron streaming treasury - receives 100% of subscription payment
    /// Distributed on epoch end: 80% creator, 5% platform, 3% ecosystem, 12% holder pool
    /// CHECK: PDA verified by seeds
    #[account(
        mut,
        seeds = [CREATOR_PATRON_TREASURY_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_patron_treasury: AccountInfo<'info>,

    /// User's subscription to this creator (to be created)
    #[account(
        init,
        payer = subscriber,
        space = 8 + CreatorPatronSubscription::INIT_SPACE,
        seeds = [CREATOR_PATRON_SUB_SEED, subscriber.key().as_ref(), creator.key().as_ref()],
        bump
    )]
    pub patron_subscription: Account<'info, CreatorPatronSubscription>,

    /// The creator being subscribed to
    /// CHECK: Verified against patron_config.creator
    #[account(
        constraint = creator.key() == patron_config.creator @ ContentRegistryError::Unauthorized
    )]
    pub creator: AccountInfo<'info>,

    /// The subscriber paying for the subscription
    #[account(mut)]
    pub subscriber: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Subscribe to creator (payment to streaming treasury for epoch-based distribution)
/// Full payment goes to CreatorPatronStreamingTreasury, distributed on epoch end
pub fn handle_subscribe_patron(
    ctx: Context<SubscribePatron>,
    tier: PatronTier,
) -> Result<()> {
    let timestamp = Clock::get()?.unix_timestamp;
    let config = &ctx.accounts.patron_config;

    // Get price based on tier
    let price = match tier {
        PatronTier::Membership => {
            require!(config.membership_price > 0, ContentRegistryError::TierNotAvailable);
            config.membership_price
        }
        PatronTier::Subscription => {
            require!(config.subscription_price > 0, ContentRegistryError::TierNotAvailable);
            config.subscription_price
        }
    };

    // Transfer FULL payment to streaming treasury
    // Will be distributed on epoch end: 80% creator, 5% platform, 3% ecosystem, 12% pool
    if price > 0 {
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.subscriber.key(),
            &ctx.accounts.creator_patron_treasury.key(),
            price,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.subscriber.to_account_info(),
                ctx.accounts.creator_patron_treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    }

    // Initialize subscription
    let subscription = &mut ctx.accounts.patron_subscription;
    subscription.subscriber = ctx.accounts.subscriber.key();
    subscription.creator = ctx.accounts.creator.key();
    subscription.tier = tier;
    subscription.stream_id = Pubkey::default(); // No stream yet - direct payment
    subscription.started_at = timestamp;
    subscription.is_active = true;

    msg!("Patron subscription created (payment to streaming treasury)");
    msg!("  Subscriber: {}", ctx.accounts.subscriber.key());
    msg!("  Creator: {}", ctx.accounts.creator.key());
    msg!("  Tier: {:?}", tier);
    msg!("  Price: {} lamports (to streaming treasury)", price);

    Ok(())
}

// ============================================================================
// CANCEL PATRON SUBSCRIPTION
// ============================================================================

/// Cancel patron subscription and close the account
#[derive(Accounts)]
pub struct CancelPatronSubscription<'info> {
    /// The subscription to cancel
    #[account(
        mut,
        seeds = [CREATOR_PATRON_SUB_SEED, subscriber.key().as_ref(), creator.key().as_ref()],
        bump,
        constraint = patron_subscription.subscriber == subscriber.key() @ ContentRegistryError::Unauthorized,
        close = subscriber
    )]
    pub patron_subscription: Account<'info, CreatorPatronSubscription>,

    /// The creator being unsubscribed from
    /// CHECK: Used for PDA derivation
    pub creator: AccountInfo<'info>,

    /// The subscriber canceling
    #[account(mut)]
    pub subscriber: Signer<'info>,
}

/// Cancel patron subscription
pub fn handle_cancel_patron_subscription(ctx: Context<CancelPatronSubscription>) -> Result<()> {
    msg!("Patron subscription cancelled");
    msg!("  Subscriber: {}", ctx.accounts.subscriber.key());
    msg!("  Creator: {}", ctx.accounts.creator.key());

    // Account is closed by Anchor's close constraint
    Ok(())
}

// ============================================================================
// RENEW PATRON SUBSCRIPTION
// ============================================================================

/// Renew an existing patron subscription
#[derive(Accounts)]
pub struct RenewPatronSubscription<'info> {
    /// Creator's patron configuration
    #[account(
        seeds = [CREATOR_PATRON_CONFIG_SEED, creator.key().as_ref()],
        bump,
        constraint = patron_config.is_active @ ContentRegistryError::PatronConfigInactive
    )]
    pub patron_config: Account<'info, CreatorPatronConfig>,

    /// Creator's patron streaming treasury - receives 100% of renewal payment
    /// CHECK: PDA verified by seeds
    #[account(
        mut,
        seeds = [CREATOR_PATRON_TREASURY_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_patron_treasury: AccountInfo<'info>,

    /// Existing subscription to renew
    #[account(
        mut,
        seeds = [CREATOR_PATRON_SUB_SEED, subscriber.key().as_ref(), creator.key().as_ref()],
        bump,
        constraint = patron_subscription.subscriber == subscriber.key() @ ContentRegistryError::Unauthorized
    )]
    pub patron_subscription: Account<'info, CreatorPatronSubscription>,

    /// The creator
    /// CHECK: Verified against patron_config.creator
    #[account(
        constraint = creator.key() == patron_config.creator @ ContentRegistryError::Unauthorized
    )]
    pub creator: AccountInfo<'info>,

    /// The subscriber paying for renewal
    #[account(mut)]
    pub subscriber: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Renew patron subscription (payment to streaming treasury)
pub fn handle_renew_patron_subscription(ctx: Context<RenewPatronSubscription>) -> Result<()> {
    let timestamp = Clock::get()?.unix_timestamp;
    let subscription = &ctx.accounts.patron_subscription;
    let config = &ctx.accounts.patron_config;

    // Get price based on current tier
    let price = match subscription.tier {
        PatronTier::Membership => {
            require!(config.membership_price > 0, ContentRegistryError::TierNotAvailable);
            config.membership_price
        }
        PatronTier::Subscription => {
            require!(config.subscription_price > 0, ContentRegistryError::TierNotAvailable);
            config.subscription_price
        }
    };

    // Transfer FULL payment to streaming treasury
    // Will be distributed on epoch end: 80% creator, 5% platform, 3% ecosystem, 12% pool
    if price > 0 {
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.subscriber.key(),
            &ctx.accounts.creator_patron_treasury.key(),
            price,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.subscriber.to_account_info(),
                ctx.accounts.creator_patron_treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    }

    // Update subscription timestamp
    let subscription = &mut ctx.accounts.patron_subscription;
    subscription.started_at = timestamp;
    subscription.is_active = true;

    msg!("Patron subscription renewed (payment to streaming treasury)");
    msg!("  Subscriber: {}", ctx.accounts.subscriber.key());
    msg!("  Creator: {}", ctx.accounts.creator.key());
    msg!("  Price: {} lamports (to streaming treasury)", price);

    Ok(())
}
