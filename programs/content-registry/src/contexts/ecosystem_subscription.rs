use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ContentRegistryError;

// ============================================================================
// SUBSCRIBE TO ECOSYSTEM (epoch-based lazy distribution)
// ============================================================================

/// Subscribe to ecosystem (Streamflow payment)
/// Payment handled by Streamflow stream to treasury, distributed on epoch end
#[derive(Accounts)]
pub struct SubscribeEcosystem<'info> {
    /// Ecosystem subscription config
    #[account(
        seeds = [ECOSYSTEM_SUB_CONFIG_SEED],
        bump,
        constraint = ecosystem_sub_config.is_active @ ContentRegistryError::EcosystemSubInactive
    )]
    pub ecosystem_sub_config: Account<'info, EcosystemSubConfig>,

    /// User's ecosystem subscription (to be created)
    #[account(
        init,
        payer = subscriber,
        space = 8 + EcosystemSubscription::INIT_SPACE,
        seeds = [ECOSYSTEM_SUB_SEED, subscriber.key().as_ref()],
        bump
    )]
    pub ecosystem_subscription: Account<'info, EcosystemSubscription>,

    /// The subscriber creating the subscription
    #[account(mut)]
    pub subscriber: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Subscribe to ecosystem (Streamflow handles payment)
/// Creates subscription record - actual payment is via Streamflow stream to treasury
/// stream_id: The Streamflow stream ID for this subscription's payment
pub fn handle_subscribe_ecosystem(ctx: Context<SubscribeEcosystem>, stream_id: Pubkey) -> Result<()> {
    let timestamp = Clock::get()?.unix_timestamp;

    // Initialize subscription record (payment handled by Streamflow)
    let subscription = &mut ctx.accounts.ecosystem_subscription;
    subscription.subscriber = ctx.accounts.subscriber.key();
    subscription.stream_id = stream_id;
    subscription.started_at = timestamp;
    subscription.is_active = true;

    msg!("Ecosystem subscription created (Streamflow payment)");
    msg!("  Subscriber: {}", ctx.accounts.subscriber.key());
    msg!("  Stream ID: {}", stream_id);

    Ok(())
}

// ============================================================================
// CANCEL ECOSYSTEM SUBSCRIPTION
// ============================================================================

/// Cancel ecosystem subscription and close the account
#[derive(Accounts)]
pub struct CancelEcosystemSubscription<'info> {
    /// The subscription to cancel
    #[account(
        mut,
        seeds = [ECOSYSTEM_SUB_SEED, subscriber.key().as_ref()],
        bump,
        constraint = ecosystem_subscription.subscriber == subscriber.key() @ ContentRegistryError::Unauthorized,
        close = subscriber
    )]
    pub ecosystem_subscription: Account<'info, EcosystemSubscription>,

    /// The subscriber canceling
    #[account(mut)]
    pub subscriber: Signer<'info>,
}

/// Cancel ecosystem subscription
pub fn handle_cancel_ecosystem_subscription(ctx: Context<CancelEcosystemSubscription>) -> Result<()> {
    msg!("Ecosystem subscription cancelled");
    msg!("  Subscriber: {}", ctx.accounts.subscriber.key());

    // Account is closed by Anchor's close constraint
    Ok(())
}

// ============================================================================
// RENEW ECOSYSTEM SUBSCRIPTION
// ============================================================================

/// Renew an existing ecosystem subscription
#[derive(Accounts)]
pub struct RenewEcosystemSubscription<'info> {
    /// Ecosystem subscription config
    #[account(
        seeds = [ECOSYSTEM_SUB_CONFIG_SEED],
        bump,
        constraint = ecosystem_sub_config.is_active @ ContentRegistryError::EcosystemSubInactive
    )]
    pub ecosystem_sub_config: Account<'info, EcosystemSubConfig>,

    /// Existing subscription to renew
    #[account(
        mut,
        seeds = [ECOSYSTEM_SUB_SEED, subscriber.key().as_ref()],
        bump,
        constraint = ecosystem_subscription.subscriber == subscriber.key() @ ContentRegistryError::Unauthorized
    )]
    pub ecosystem_subscription: Account<'info, EcosystemSubscription>,

    /// The subscriber renewing
    pub subscriber: Signer<'info>,
}

/// Renew ecosystem subscription (Streamflow topup extends the stream)
/// Updates subscription timestamp - stream_id stays the same
pub fn handle_renew_ecosystem_subscription(ctx: Context<RenewEcosystemSubscription>) -> Result<()> {
    let timestamp = Clock::get()?.unix_timestamp;

    // Update subscription timestamp (stream topup handled externally)
    let subscription = &mut ctx.accounts.ecosystem_subscription;
    subscription.started_at = timestamp;
    subscription.is_active = true;

    msg!("Ecosystem subscription renewed (via Streamflow topup)");
    msg!("  Subscriber: {}", ctx.accounts.subscriber.key());
    msg!("  Stream ID (unchanged): {}", subscription.stream_id);

    Ok(())
}

// ============================================================================
// CHECK SUBSCRIPTION VALIDITY
// ============================================================================

/// Check if a user has valid access via patron or ecosystem subscription
/// This is a view-only instruction that doesn't modify state
#[derive(Accounts)]
pub struct CheckSubscriptionAccess<'info> {
    /// Content to check access for
    pub content: Account<'info, ContentEntry>,

    /// Optional: User's patron subscription to the content creator
    /// CHECK: PDA verified if account exists
    pub patron_subscription: Option<AccountInfo<'info>>,

    /// Optional: User's ecosystem subscription
    /// CHECK: PDA verified if account exists
    pub ecosystem_subscription: Option<AccountInfo<'info>>,

    /// The user checking access
    pub user: Signer<'info>,
}

/// Check subscription access for content
/// Returns Ok if access granted, Err if denied
///
/// Visibility Levels (4-tier system):
/// - Level 0: Public - anyone can access (free content)
/// - Level 1: Ecosystem - ecosystem sub OR creator sub OR NFT/Rental
/// - Level 2: Subscriber - creator sub OR NFT/Rental only (ecosystem sub NOT enough)
/// - Level 3: NFT Only - ONLY NFT owners or renters (subscriptions don't grant access)
///
/// Note: This instruction only checks SUBSCRIPTION access. NFT/Rental ownership
/// is verified separately (typically off-chain) since it requires fetching NFT metadata.
/// For Level 3 content, this instruction will always return SubscriptionRequired
/// because subscriptions cannot grant access - caller must verify NFT/Rental separately.
pub fn handle_check_subscription_access(ctx: Context<CheckSubscriptionAccess>) -> Result<()> {
    let content = &ctx.accounts.content;
    let visibility = content.visibility_level;
    let now = Clock::get()?.unix_timestamp;

    // Level 0: Public (no subscription needed)
    if visibility == 0 {
        msg!("Access granted: public content");
        return Ok(());
    }

    // Level 3: NFT/Rental Only - subscriptions CANNOT grant access
    // Caller must verify NFT/Rental ownership separately
    if visibility == 3 {
        msg!("Access denied: Level 3 content requires NFT or rental (subscriptions not accepted)");
        return Err(ContentRegistryError::NftOrRentalRequired.into());
    }

    // Level 2: Creator subscription OR NFT/Rental
    // Check creator subscription first (works for both Level 1 and Level 2)
    if visibility <= 2 {
        if let Some(patron_sub_info) = &ctx.accounts.patron_subscription {
            // Verify PDA
            let (expected_pda, _bump) = Pubkey::find_program_address(
                &[
                    CREATOR_PATRON_SUB_SEED,
                    ctx.accounts.user.key().as_ref(),
                    content.creator.as_ref(),
                ],
                &crate::id(),
            );

            if patron_sub_info.key() == expected_pda {
                // Try to deserialize
                let data = patron_sub_info.try_borrow_data()?;
                if data.len() >= 8 + CreatorPatronSubscription::INIT_SPACE {
                    let patron_sub: CreatorPatronSubscription = CreatorPatronSubscription::try_deserialize(
                        &mut &data[..]
                    )?;

                    // Check if active subscription tier (NOT membership) and within 30 days
                    // Membership is support-only, does NOT grant content access
                    if patron_sub.is_active
                        && patron_sub.tier == PatronTier::Subscription
                        && now < patron_sub.started_at + DEFAULT_EPOCH_DURATION
                    {
                        msg!("Access granted: valid creator subscription");
                        return Ok(());
                    }
                }
            }
        }
    }

    // Level 1: Ecosystem subscription also accepted (in addition to creator sub)
    if visibility == 1 {
        if let Some(eco_sub_info) = &ctx.accounts.ecosystem_subscription {
            // Verify PDA
            let (expected_pda, _bump) = Pubkey::find_program_address(
                &[ECOSYSTEM_SUB_SEED, ctx.accounts.user.key().as_ref()],
                &crate::id(),
            );

            if eco_sub_info.key() == expected_pda {
                // Try to deserialize
                let data = eco_sub_info.try_borrow_data()?;
                if data.len() >= 8 + EcosystemSubscription::INIT_SPACE {
                    let eco_sub: EcosystemSubscription = EcosystemSubscription::try_deserialize(
                        &mut &data[..]
                    )?;

                    // Check if active and within 30 days
                    if eco_sub.is_active && now < eco_sub.started_at + DEFAULT_EPOCH_DURATION {
                        msg!("Access granted: valid ecosystem subscription");
                        return Ok(());
                    }
                }
            }
        }
    }

    // No valid subscription found for this visibility level
    // Caller should check NFT/Rental ownership as fallback
    msg!("Access denied: no valid subscription for visibility level {}", visibility);
    Err(ContentRegistryError::SubscriptionRequired.into())
}
