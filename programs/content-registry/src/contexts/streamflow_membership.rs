use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use streamflow_sdk::cpi::accounts::{
    Create as StreamflowCreate,
    Cancel as StreamflowCancel,
    Topup as StreamflowTopup,
};

use crate::state::*;
use crate::errors::ContentRegistryError;

// Use Streamflow SDK's program ID (configured via its devnet feature)
pub use streamflow_sdk::ID as STREAMFLOW_PROGRAM_ID;

// WSOL mint (native SOL wrapped)
pub const WSOL_MINT: Pubkey = anchor_spl::token::spl_token::native_mint::ID;

// Streamflow treasury (for their 0.25% fee) - same on devnet and mainnet
// Source: https://docs.streamflow.finance
pub mod streamflow_constants {
    use anchor_lang::prelude::*;
    declare_id!("5SEpbdjFK5FxwTvfsGMXVQTD2v4M2c5tyRTxhdsPkgDw");
}
pub const STREAMFLOW_TREASURY: Pubkey = streamflow_constants::ID;

// Streamflow withdrawor (for automatic withdrawals - we don't use this)
pub mod withdrawor_constants {
    use anchor_lang::prelude::*;
    declare_id!("wdrwhnCv4pzW8beKsbPa4S2UDZrXenjg16KJdKSpb5u");
}
pub const STREAMFLOW_WITHDRAWOR: Pubkey = withdrawor_constants::ID;

// Streamflow fee oracle
pub mod fee_oracle_constants {
    use anchor_lang::prelude::*;
    declare_id!("B743wFVk2pCYhV91cn287e1xY7f1vt4gdY48hhNiuQmT");
}
pub const STREAMFLOW_FEE_ORACLE: Pubkey = fee_oracle_constants::ID;

// Stream duration constants
pub const SECONDS_PER_DAY: u64 = 86_400;
pub const SECONDS_PER_MONTH: u64 = 30 * SECONDS_PER_DAY; // 30 days
pub const SECONDS_PER_YEAR: u64 = 365 * SECONDS_PER_DAY; // 365 days

// ============================================================================
// JOIN ECOSYSTEM MEMBERSHIP (Program creates Streamflow stream)
// ============================================================================

/// Join ecosystem membership - program creates Streamflow stream to treasury PDA
/// This is secure because the program controls the recipient (treasury PDA)
#[derive(Accounts)]
pub struct JoinEcosystemMembership<'info> {
    // === User accounts ===
    #[account(mut)]
    pub subscriber: Signer<'info>,

    /// Subscriber's WSOL token account (source of funds)
    #[account(
        mut,
        associated_token::mint = wsol_mint,
        associated_token::authority = subscriber,
    )]
    pub subscriber_wsol: Box<Account<'info, TokenAccount>>,

    // === Ecosystem accounts ===
    /// Ecosystem subscription config (must be active)
    #[account(
        seeds = [ECOSYSTEM_SUB_CONFIG_SEED],
        bump,
        constraint = ecosystem_config.is_active @ ContentRegistryError::EcosystemSubInactive
    )]
    pub ecosystem_config: Account<'info, EcosystemSubConfig>,

    /// User's ecosystem subscription record (created or reused if cancelled)
    #[account(
        init_if_needed,
        payer = subscriber,
        space = 8 + EcosystemSubscription::INIT_SPACE,
        seeds = [ECOSYSTEM_SUB_SEED, subscriber.key().as_ref()],
        bump
    )]
    pub ecosystem_subscription: Account<'info, EcosystemSubscription>,

    /// Ecosystem streaming treasury PDA - ENFORCED recipient
    /// CHECK: PDA verified by seeds - this is where funds MUST go
    #[account(
        mut,
        seeds = [ECOSYSTEM_STREAMING_TREASURY_SEED],
        bump
    )]
    pub ecosystem_treasury: AccountInfo<'info>,

    /// Treasury's WSOL token account (receives streamed funds)
    #[account(
        init_if_needed,
        payer = subscriber,
        associated_token::mint = wsol_mint,
        associated_token::authority = ecosystem_treasury,
    )]
    pub ecosystem_treasury_wsol: Box<Account<'info, TokenAccount>>,

    // === Streamflow accounts ===
    /// Stream metadata account (Streamflow creates this)
    /// CHECK: Will be initialized by Streamflow
    #[account(mut)]
    pub stream_metadata: Signer<'info>,

    /// Escrow token account holding streamed funds
    /// CHECK: PDA derived by Streamflow program
    #[account(mut)]
    pub escrow_tokens: AccountInfo<'info>,

    /// Streamflow treasury for their fee
    /// CHECK: Known Streamflow account
    #[account(mut, address = STREAMFLOW_TREASURY)]
    pub streamflow_treasury: AccountInfo<'info>,

    /// Streamflow treasury WSOL account
    #[account(
        init_if_needed,
        payer = subscriber,
        associated_token::mint = wsol_mint,
        associated_token::authority = streamflow_treasury,
    )]
    pub streamflow_treasury_wsol: Box<Account<'info, TokenAccount>>,

    /// Streamflow withdrawor
    /// CHECK: Known Streamflow account
    #[account(mut, address = STREAMFLOW_WITHDRAWOR)]
    pub streamflow_withdrawor: AccountInfo<'info>,

    /// Partner account (we use our own program as partner for 0 fee)
    /// CHECK: We set this to subscriber for no partner fee
    #[account(mut)]
    pub partner: AccountInfo<'info>,

    /// Partner WSOL account
    #[account(
        init_if_needed,
        payer = subscriber,
        associated_token::mint = wsol_mint,
        associated_token::authority = partner,
    )]
    pub partner_wsol: Box<Account<'info, TokenAccount>>,

    /// WSOL mint
    #[account(address = WSOL_MINT)]
    pub wsol_mint: Box<Account<'info, Mint>>,

    /// Streamflow fee oracle
    /// CHECK: Known Streamflow account
    #[account(address = STREAMFLOW_FEE_ORACLE)]
    pub fee_oracle: AccountInfo<'info>,

    /// Streamflow program
    /// CHECK: Verified by address
    #[account(address = STREAMFLOW_PROGRAM_ID)]
    pub streamflow_program: AccountInfo<'info>,

    // === System accounts ===
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Join ecosystem membership with specified duration
/// duration_type: 0 = monthly (30 days), 1 = yearly (365 days)
pub fn handle_join_ecosystem_membership(
    ctx: Context<JoinEcosystemMembership>,
    duration_type: u8,
) -> Result<()> {
    let config = &ctx.accounts.ecosystem_config;
    let timestamp = Clock::get()?.unix_timestamp as u64;

    // Calculate amount and duration based on type
    let (amount, duration_seconds) = match duration_type {
        0 => (config.price, SECONDS_PER_MONTH), // Monthly
        1 => (config.price * 10, SECONDS_PER_YEAR), // Yearly (10 months price for 12 months)
        _ => return Err(ContentRegistryError::InvalidDurationType.into()),
    };

    // Calculate streaming parameters
    let period: u64 = 1; // Release every 1 second
    let amount_per_period = amount / duration_seconds;
    // Adjust amount to be exactly divisible by duration for precise end time
    // (User pays slightly less - negligible difference of a few lamports)
    let adjusted_amount = amount_per_period * duration_seconds;
    let start_time = timestamp + 60; // Start 60 seconds from now
    let cliff = start_time; // No cliff
    let cliff_amount: u64 = 0;

    // Create stream name
    let stream_name = if duration_type == 0 {
        create_stream_name(b"EcoMembership")
    } else {
        create_stream_name(b"EcoMembershipYr")
    };

    // Build Streamflow CPI accounts
    // SECURITY: recipient is ecosystem_treasury PDA - enforced by our program
    let cpi_accounts = StreamflowCreate {
        sender: ctx.accounts.subscriber.to_account_info(),
        sender_tokens: ctx.accounts.subscriber_wsol.to_account_info(),
        recipient: ctx.accounts.ecosystem_treasury.to_account_info(), // ENFORCED by seeds
        recipient_tokens: ctx.accounts.ecosystem_treasury_wsol.to_account_info(),
        metadata: ctx.accounts.stream_metadata.to_account_info(),
        escrow_tokens: ctx.accounts.escrow_tokens.to_account_info(),
        streamflow_treasury: ctx.accounts.streamflow_treasury.to_account_info(),
        streamflow_treasury_tokens: ctx.accounts.streamflow_treasury_wsol.to_account_info(),
        withdrawor: ctx.accounts.streamflow_withdrawor.to_account_info(),
        partner: ctx.accounts.partner.to_account_info(),
        partner_tokens: ctx.accounts.partner_wsol.to_account_info(),
        mint: ctx.accounts.wsol_mint.to_account_info(),
        fee_oracle: ctx.accounts.fee_oracle.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
        timelock_program: ctx.accounts.streamflow_program.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(
        ctx.accounts.streamflow_program.to_account_info(),
        cpi_accounts,
    );

    // Create the stream via CPI (using adjusted_amount for exact duration)
    streamflow_sdk::cpi::create(
        cpi_ctx,
        start_time,
        adjusted_amount, // Use adjusted amount for exact duration
        period,
        amount_per_period,
        cliff,
        cliff_amount,
        true,  // cancelable_by_sender
        false, // cancelable_by_recipient
        true,  // automatic_withdrawal - Streamflow auto-withdraws to treasury
        false, // transferable_by_sender
        false, // transferable_by_recipient
        true,  // can_topup (for renewals)
        stream_name,
        86400, // withdraw_frequency: daily (matches epoch duration)
        None,  // pausable
        None,  // can_update_rate
    )?;

    // Store subscription record
    let subscription = &mut ctx.accounts.ecosystem_subscription;
    subscription.subscriber = ctx.accounts.subscriber.key();
    subscription.stream_id = ctx.accounts.stream_metadata.key();
    subscription.started_at = timestamp as i64;
    subscription.is_active = true;

    msg!("Ecosystem membership created via Streamflow");
    msg!("  Subscriber: {}", ctx.accounts.subscriber.key());
    msg!("  Stream ID: {}", ctx.accounts.stream_metadata.key());
    msg!("  Treasury (enforced): {}", ctx.accounts.ecosystem_treasury.key());
    msg!("  Amount: {} lamports (adjusted from {})", adjusted_amount, amount);
    msg!("  Duration: {} days", duration_seconds / SECONDS_PER_DAY);

    Ok(())
}

// ============================================================================
// JOIN CREATOR MEMBERSHIP (Program creates Streamflow stream)
// ============================================================================

/// Join creator membership - program creates Streamflow stream to creator's treasury PDA
#[derive(Accounts)]
pub struct JoinCreatorMembership<'info> {
    // === User accounts ===
    #[account(mut)]
    pub subscriber: Signer<'info>,

    /// Subscriber's WSOL token account
    #[account(
        mut,
        associated_token::mint = wsol_mint,
        associated_token::authority = subscriber,
    )]
    pub subscriber_wsol: Box<Account<'info, TokenAccount>>,

    // === Creator accounts ===
    /// CHECK: Creator wallet address
    pub creator: AccountInfo<'info>,

    /// Creator's patron config (must be active)
    #[account(
        seeds = [CREATOR_PATRON_CONFIG_SEED, creator.key().as_ref()],
        bump,
        constraint = patron_config.is_active @ ContentRegistryError::PatronConfigInactive,
        constraint = patron_config.creator == creator.key() @ ContentRegistryError::Unauthorized
    )]
    pub patron_config: Account<'info, CreatorPatronConfig>,

    /// User's subscription to this creator (to be created)
    #[account(
        init,
        payer = subscriber,
        space = 8 + CreatorPatronSubscription::INIT_SPACE,
        seeds = [CREATOR_PATRON_SUB_SEED, subscriber.key().as_ref(), creator.key().as_ref()],
        bump
    )]
    pub patron_subscription: Account<'info, CreatorPatronSubscription>,

    /// Creator's streaming treasury PDA - ENFORCED recipient
    /// CHECK: PDA verified by seeds - this is where funds MUST go
    #[account(
        mut,
        seeds = [CREATOR_PATRON_TREASURY_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_treasury: AccountInfo<'info>,

    /// Treasury's WSOL token account
    #[account(
        init_if_needed,
        payer = subscriber,
        associated_token::mint = wsol_mint,
        associated_token::authority = creator_treasury,
    )]
    pub creator_treasury_wsol: Box<Account<'info, TokenAccount>>,

    // === Streamflow accounts (same as ecosystem) ===
    /// CHECK: Will be initialized by Streamflow
    #[account(mut)]
    pub stream_metadata: Signer<'info>,

    /// CHECK: PDA derived by Streamflow
    #[account(mut)]
    pub escrow_tokens: AccountInfo<'info>,

    /// CHECK: Known Streamflow account
    #[account(mut, address = STREAMFLOW_TREASURY)]
    pub streamflow_treasury: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = subscriber,
        associated_token::mint = wsol_mint,
        associated_token::authority = streamflow_treasury,
    )]
    pub streamflow_treasury_wsol: Box<Account<'info, TokenAccount>>,

    /// CHECK: Known Streamflow account
    #[account(mut, address = STREAMFLOW_WITHDRAWOR)]
    pub streamflow_withdrawor: AccountInfo<'info>,

    /// CHECK: Partner for fees
    #[account(mut)]
    pub partner: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = subscriber,
        associated_token::mint = wsol_mint,
        associated_token::authority = partner,
    )]
    pub partner_wsol: Box<Account<'info, TokenAccount>>,

    #[account(address = WSOL_MINT)]
    pub wsol_mint: Box<Account<'info, Mint>>,

    /// CHECK: Known Streamflow account
    #[account(address = STREAMFLOW_FEE_ORACLE)]
    pub fee_oracle: AccountInfo<'info>,

    /// CHECK: Verified by address
    #[account(address = STREAMFLOW_PROGRAM_ID)]
    pub streamflow_program: AccountInfo<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Join creator membership
/// tier: 0 = Membership (support only), 1 = Subscription (support + access)
/// duration_type: 0 = monthly, 1 = yearly
pub fn handle_join_creator_membership(
    ctx: Context<JoinCreatorMembership>,
    tier: u8,
    duration_type: u8,
) -> Result<()> {
    let config = &ctx.accounts.patron_config;
    let timestamp = Clock::get()?.unix_timestamp as u64;

    // Get price based on tier
    let base_price = match tier {
        0 => {
            require!(config.membership_price > 0, ContentRegistryError::TierNotAvailable);
            config.membership_price
        }
        1 => {
            require!(config.subscription_price > 0, ContentRegistryError::TierNotAvailable);
            config.subscription_price
        }
        _ => return Err(ContentRegistryError::InvalidTier.into()),
    };

    // Calculate amount and duration
    let (amount, duration_seconds) = match duration_type {
        0 => (base_price, SECONDS_PER_MONTH),
        1 => (base_price * 10, SECONDS_PER_YEAR),
        _ => return Err(ContentRegistryError::InvalidDurationType.into()),
    };

    let period: u64 = 1;
    let amount_per_period = amount / duration_seconds;
    // Adjust amount to be exactly divisible by duration for precise end time
    let adjusted_amount = amount_per_period * duration_seconds;
    let start_time = timestamp + 60;
    let cliff = start_time;
    let cliff_amount: u64 = 0;

    let stream_name = create_stream_name(b"CreatorMembership");

    // Build CPI - recipient is creator_treasury PDA (ENFORCED)
    let cpi_accounts = StreamflowCreate {
        sender: ctx.accounts.subscriber.to_account_info(),
        sender_tokens: ctx.accounts.subscriber_wsol.to_account_info(),
        recipient: ctx.accounts.creator_treasury.to_account_info(), // ENFORCED by seeds
        recipient_tokens: ctx.accounts.creator_treasury_wsol.to_account_info(),
        metadata: ctx.accounts.stream_metadata.to_account_info(),
        escrow_tokens: ctx.accounts.escrow_tokens.to_account_info(),
        streamflow_treasury: ctx.accounts.streamflow_treasury.to_account_info(),
        streamflow_treasury_tokens: ctx.accounts.streamflow_treasury_wsol.to_account_info(),
        withdrawor: ctx.accounts.streamflow_withdrawor.to_account_info(),
        partner: ctx.accounts.partner.to_account_info(),
        partner_tokens: ctx.accounts.partner_wsol.to_account_info(),
        mint: ctx.accounts.wsol_mint.to_account_info(),
        fee_oracle: ctx.accounts.fee_oracle.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
        timelock_program: ctx.accounts.streamflow_program.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(
        ctx.accounts.streamflow_program.to_account_info(),
        cpi_accounts,
    );

    streamflow_sdk::cpi::create(
        cpi_ctx,
        start_time,
        adjusted_amount, // Use adjusted amount for exact duration
        period,
        amount_per_period,
        cliff,
        cliff_amount,
        true,  // cancelable_by_sender
        false, // cancelable_by_recipient
        true,  // automatic_withdrawal - Streamflow auto-withdraws to treasury
        false, // transferable_by_sender
        false, // transferable_by_recipient
        true,  // can_topup
        stream_name,
        86400, // withdraw_frequency: daily (matches epoch duration)
        None,
        None,
    )?;

    // Store subscription record
    let subscription = &mut ctx.accounts.patron_subscription;
    subscription.subscriber = ctx.accounts.subscriber.key();
    subscription.creator = ctx.accounts.creator.key();
    subscription.tier = if tier == 0 { PatronTier::Membership } else { PatronTier::Subscription };
    subscription.stream_id = ctx.accounts.stream_metadata.key();
    subscription.started_at = timestamp as i64;
    subscription.is_active = true;

    msg!("Creator membership created via Streamflow");
    msg!("  Subscriber: {}", ctx.accounts.subscriber.key());
    msg!("  Creator: {}", ctx.accounts.creator.key());
    msg!("  Stream ID: {}", ctx.accounts.stream_metadata.key());
    msg!("  Treasury (enforced): {}", ctx.accounts.creator_treasury.key());
    msg!("  Amount: {} lamports (adjusted)", adjusted_amount);

    Ok(())
}

// ============================================================================
// CANCEL MEMBERSHIP (Returns remaining funds to user)
// ============================================================================

/// Cancel ecosystem membership - cancels Streamflow stream and returns funds
#[derive(Accounts)]
pub struct CancelEcosystemMembershipStream<'info> {
    #[account(mut)]
    pub subscriber: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = wsol_mint,
        associated_token::authority = subscriber,
    )]
    pub subscriber_wsol: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [ECOSYSTEM_SUB_SEED, subscriber.key().as_ref()],
        bump,
        constraint = ecosystem_subscription.subscriber == subscriber.key() @ ContentRegistryError::Unauthorized,
        close = subscriber
    )]
    pub ecosystem_subscription: Account<'info, EcosystemSubscription>,

    /// CHECK: PDA verified by seeds
    #[account(
        mut,
        seeds = [ECOSYSTEM_STREAMING_TREASURY_SEED],
        bump
    )]
    pub ecosystem_treasury: AccountInfo<'info>,

    #[account(
        mut,
        associated_token::mint = wsol_mint,
        associated_token::authority = ecosystem_treasury,
    )]
    pub ecosystem_treasury_wsol: Box<Account<'info, TokenAccount>>,

    // Streamflow stream accounts
    /// CHECK: Stream metadata - verified against subscription record
    #[account(
        mut,
        constraint = stream_metadata.key() == ecosystem_subscription.stream_id @ ContentRegistryError::InvalidStreamId
    )]
    pub stream_metadata: AccountInfo<'info>,

    /// CHECK: Escrow tokens PDA
    #[account(mut)]
    pub escrow_tokens: AccountInfo<'info>,

    /// CHECK: Known Streamflow account
    #[account(mut, address = STREAMFLOW_TREASURY)]
    pub streamflow_treasury: AccountInfo<'info>,

    #[account(
        mut,
        associated_token::mint = wsol_mint,
        associated_token::authority = streamflow_treasury,
    )]
    pub streamflow_treasury_wsol: Box<Account<'info, TokenAccount>>,

    /// CHECK: Partner
    #[account(mut)]
    pub partner: AccountInfo<'info>,

    #[account(
        mut,
        associated_token::mint = wsol_mint,
        associated_token::authority = partner,
    )]
    pub partner_wsol: Box<Account<'info, TokenAccount>>,

    #[account(address = WSOL_MINT)]
    pub wsol_mint: Box<Account<'info, Mint>>,

    /// CHECK: Verified by address
    #[account(address = STREAMFLOW_PROGRAM_ID)]
    pub streamflow_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_cancel_ecosystem_membership_stream(
    ctx: Context<CancelEcosystemMembershipStream>,
) -> Result<()> {
    let cpi_accounts = StreamflowCancel {
        authority: ctx.accounts.subscriber.to_account_info(),
        sender: ctx.accounts.subscriber.to_account_info(),
        sender_tokens: ctx.accounts.subscriber_wsol.to_account_info(),
        recipient: ctx.accounts.ecosystem_treasury.to_account_info(),
        recipient_tokens: ctx.accounts.ecosystem_treasury_wsol.to_account_info(),
        metadata: ctx.accounts.stream_metadata.to_account_info(),
        escrow_tokens: ctx.accounts.escrow_tokens.to_account_info(),
        streamflow_treasury: ctx.accounts.streamflow_treasury.to_account_info(),
        streamflow_treasury_tokens: ctx.accounts.streamflow_treasury_wsol.to_account_info(),
        partner: ctx.accounts.partner.to_account_info(),
        partner_tokens: ctx.accounts.partner_wsol.to_account_info(),
        mint: ctx.accounts.wsol_mint.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(
        ctx.accounts.streamflow_program.to_account_info(),
        cpi_accounts,
    );

    streamflow_sdk::cpi::cancel(cpi_ctx)?;

    msg!("Ecosystem membership cancelled, funds returned");
    msg!("  Subscriber: {}", ctx.accounts.subscriber.key());

    Ok(())
}

// ============================================================================
// TOPUP MEMBERSHIP (Extend duration)
// ============================================================================

/// Topup ecosystem membership - extends existing stream
#[derive(Accounts)]
pub struct TopupEcosystemMembership<'info> {
    #[account(mut)]
    pub subscriber: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = wsol_mint,
        associated_token::authority = subscriber,
    )]
    pub subscriber_wsol: Box<Account<'info, TokenAccount>>,

    #[account(
        seeds = [ECOSYSTEM_SUB_CONFIG_SEED],
        bump,
        constraint = ecosystem_config.is_active @ ContentRegistryError::EcosystemSubInactive
    )]
    pub ecosystem_config: Account<'info, EcosystemSubConfig>,

    #[account(
        mut,
        seeds = [ECOSYSTEM_SUB_SEED, subscriber.key().as_ref()],
        bump,
        constraint = ecosystem_subscription.subscriber == subscriber.key() @ ContentRegistryError::Unauthorized
    )]
    pub ecosystem_subscription: Account<'info, EcosystemSubscription>,

    /// CHECK: Stream metadata
    #[account(
        mut,
        constraint = stream_metadata.key() == ecosystem_subscription.stream_id @ ContentRegistryError::InvalidStreamId
    )]
    pub stream_metadata: AccountInfo<'info>,

    /// CHECK: Escrow tokens
    #[account(mut)]
    pub escrow_tokens: Box<Account<'info, TokenAccount>>,

    /// CHECK: Known Streamflow account
    #[account(mut, address = STREAMFLOW_TREASURY)]
    pub streamflow_treasury: AccountInfo<'info>,

    #[account(
        mut,
        associated_token::mint = wsol_mint,
        associated_token::authority = streamflow_treasury,
    )]
    pub streamflow_treasury_wsol: Box<Account<'info, TokenAccount>>,

    /// CHECK: Known Streamflow account
    #[account(mut, address = STREAMFLOW_WITHDRAWOR)]
    pub streamflow_withdrawor: AccountInfo<'info>,

    /// CHECK: Partner for fees (can be same as streamflow_treasury if no partner)
    #[account(mut)]
    pub partner: AccountInfo<'info>,

    #[account(
        mut,
        associated_token::mint = wsol_mint,
        associated_token::authority = partner,
    )]
    pub partner_wsol: Box<Account<'info, TokenAccount>>,

    #[account(address = WSOL_MINT)]
    pub wsol_mint: Box<Account<'info, Mint>>,

    /// CHECK: Verified by address
    #[account(address = STREAMFLOW_PROGRAM_ID)]
    pub streamflow_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Topup ecosystem membership
/// duration_type: 0 = monthly, 1 = yearly
pub fn handle_topup_ecosystem_membership(
    ctx: Context<TopupEcosystemMembership>,
    duration_type: u8,
) -> Result<()> {
    let config = &ctx.accounts.ecosystem_config;

    let amount = match duration_type {
        0 => config.price,
        1 => config.price * 10,
        _ => return Err(ContentRegistryError::InvalidDurationType.into()),
    };

    let cpi_accounts = StreamflowTopup {
        sender: ctx.accounts.subscriber.to_account_info(),
        sender_tokens: ctx.accounts.subscriber_wsol.to_account_info(),
        metadata: ctx.accounts.stream_metadata.to_account_info(),
        escrow_tokens: ctx.accounts.escrow_tokens.to_account_info(),
        streamflow_treasury: ctx.accounts.streamflow_treasury.to_account_info(),
        streamflow_treasury_tokens: ctx.accounts.streamflow_treasury_wsol.to_account_info(),
        withdrawor: ctx.accounts.streamflow_withdrawor.to_account_info(),
        partner: ctx.accounts.partner.to_account_info(),
        partner_tokens: ctx.accounts.partner_wsol.to_account_info(),
        mint: ctx.accounts.wsol_mint.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(
        ctx.accounts.streamflow_program.to_account_info(),
        cpi_accounts,
    );

    streamflow_sdk::cpi::topup(cpi_ctx, amount)?;

    // Update subscription timestamp
    let subscription = &mut ctx.accounts.ecosystem_subscription;
    subscription.started_at = Clock::get()?.unix_timestamp;

    msg!("Ecosystem membership extended");
    msg!("  Amount added: {} lamports", amount);

    Ok(())
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Create a 64-byte stream name from a prefix
fn create_stream_name(prefix: &[u8]) -> [u8; 64] {
    let mut name = [0u8; 64];
    let len = prefix.len().min(64);
    name[..len].copy_from_slice(&prefix[..len]);
    name
}
