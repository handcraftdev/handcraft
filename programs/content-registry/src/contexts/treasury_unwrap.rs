use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, CloseAccount, Transfer as TokenTransfer, Mint};
use streamflow_sdk::cpi::accounts::Withdraw as StreamflowWithdraw;
use crate::state::*;
use crate::errors::ContentRegistryError;
use crate::contexts::streamflow_membership::{STREAMFLOW_PROGRAM_ID, STREAMFLOW_TREASURY, WSOL_MINT};

// ============================================================================
// TREASURY WSOL MANAGEMENT
// ============================================================================
// Two-step process for Streamflow subscription payments:
// 1. WITHDRAW: Pull accumulated WSOL from Streamflow escrow to treasury's WSOL ATA
// 2. UNWRAP: Convert WSOL in ATA to native SOL in treasury PDA
//
// Both steps can be called by anyone to enable permissionless distribution.

/// Native SOL mint (WSOL)
pub const NATIVE_MINT: Pubkey = anchor_spl::token::spl_token::native_mint::ID;

/// Unwrap WSOL from ecosystem streaming treasury to native SOL
/// Anyone can call this - it just converts accumulated WSOL to SOL
#[derive(Accounts)]
pub struct UnwrapEcosystemTreasuryWsol<'info> {
    /// The ecosystem streaming treasury PDA
    /// CHECK: PDA verified by seeds
    #[account(
        mut,
        seeds = [ECOSYSTEM_STREAMING_TREASURY_SEED],
        bump
    )]
    pub ecosystem_streaming_treasury: AccountInfo<'info>,

    /// The treasury's WSOL token account
    #[account(
        mut,
        constraint = treasury_wsol_ata.owner == ecosystem_streaming_treasury.key() @ ContentRegistryError::InvalidOwner,
        constraint = treasury_wsol_ata.mint == NATIVE_MINT @ ContentRegistryError::InvalidMint
    )]
    pub treasury_wsol_ata: Account<'info, TokenAccount>,

    /// Anyone can call this to trigger unwrap
    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Handler for unwrap_ecosystem_treasury_wsol
/// Closes the WSOL ATA, which transfers all lamports (WSOL + rent) to the treasury PDA
pub fn handle_unwrap_ecosystem_treasury_wsol(ctx: Context<UnwrapEcosystemTreasuryWsol>) -> Result<()> {
    let wsol_balance = ctx.accounts.treasury_wsol_ata.amount;

    if wsol_balance == 0 {
        msg!("No WSOL to unwrap in ecosystem treasury");
        return Ok(());
    }

    msg!("Unwrapping {} WSOL from ecosystem treasury", wsol_balance);

    // Get treasury PDA bump for signing
    let (_, treasury_bump) = Pubkey::find_program_address(
        &[ECOSYSTEM_STREAMING_TREASURY_SEED],
        &crate::ID
    );
    let treasury_seeds = &[ECOSYSTEM_STREAMING_TREASURY_SEED, &[treasury_bump]];
    let treasury_signer = &[&treasury_seeds[..]];

    // Close the WSOL ATA - this transfers all lamports to the owner (treasury PDA)
    // For WSOL accounts, this effectively "unwraps" the WSOL to native SOL
    token::close_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.treasury_wsol_ata.to_account_info(),
                destination: ctx.accounts.ecosystem_streaming_treasury.to_account_info(),
                authority: ctx.accounts.ecosystem_streaming_treasury.to_account_info(),
            },
            treasury_signer,
        )
    )?;

    msg!("Unwrapped {} lamports to ecosystem streaming treasury", wsol_balance);

    Ok(())
}

/// Unwrap WSOL from creator patron treasury to native SOL
#[derive(Accounts)]
pub struct UnwrapCreatorPatronTreasuryWsol<'info> {
    /// The creator whose patron treasury to unwrap
    /// CHECK: Used as PDA seed
    pub creator: AccountInfo<'info>,

    /// The creator's patron streaming treasury PDA
    /// CHECK: PDA verified by seeds
    #[account(
        mut,
        seeds = [CREATOR_PATRON_TREASURY_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_patron_treasury: AccountInfo<'info>,

    /// The treasury's WSOL token account
    #[account(
        mut,
        constraint = treasury_wsol_ata.owner == creator_patron_treasury.key() @ ContentRegistryError::InvalidOwner,
        constraint = treasury_wsol_ata.mint == NATIVE_MINT @ ContentRegistryError::InvalidMint
    )]
    pub treasury_wsol_ata: Account<'info, TokenAccount>,

    /// Anyone can call this to trigger unwrap
    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Handler for unwrap_creator_patron_treasury_wsol
pub fn handle_unwrap_creator_patron_treasury_wsol(ctx: Context<UnwrapCreatorPatronTreasuryWsol>) -> Result<()> {
    let wsol_balance = ctx.accounts.treasury_wsol_ata.amount;

    if wsol_balance == 0 {
        msg!("No WSOL to unwrap in creator patron treasury");
        return Ok(());
    }

    msg!("Unwrapping {} WSOL from creator patron treasury for {}",
        wsol_balance, ctx.accounts.creator.key());

    // Get treasury PDA bump for signing
    let creator_key = ctx.accounts.creator.key();
    let (_, treasury_bump) = Pubkey::find_program_address(
        &[CREATOR_PATRON_TREASURY_SEED, creator_key.as_ref()],
        &crate::ID
    );
    let treasury_seeds: &[&[u8]] = &[CREATOR_PATRON_TREASURY_SEED, creator_key.as_ref(), &[treasury_bump]];
    let treasury_signer = &[treasury_seeds];

    // Close the WSOL ATA - transfers all lamports to owner (treasury PDA)
    token::close_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.treasury_wsol_ata.to_account_info(),
                destination: ctx.accounts.creator_patron_treasury.to_account_info(),
                authority: ctx.accounts.creator_patron_treasury.to_account_info(),
            },
            treasury_signer,
        )
    )?;

    msg!("Unwrapped {} lamports to creator patron treasury", wsol_balance);

    Ok(())
}

// ============================================================================
// WITHDRAW FROM STREAMFLOW
// ============================================================================
// Before unwrapping, we need to withdraw accumulated funds from Streamflow escrow
// to the treasury's WSOL ATA. The treasury PDA is the stream recipient, so our
// program signs for it to call Streamflow withdraw.

/// Withdraw accumulated WSOL from Streamflow stream to ecosystem treasury
/// Anyone can call this - pulls released funds from any ecosystem subscription stream
#[derive(Accounts)]
pub struct WithdrawEcosystemStreamToTreasury<'info> {
    /// The ecosystem streaming treasury PDA (stream recipient)
    /// CHECK: PDA verified by seeds - this is the stream recipient that receives WSOL
    #[account(
        mut,
        seeds = [ECOSYSTEM_STREAMING_TREASURY_SEED],
        bump
    )]
    pub ecosystem_streaming_treasury: AccountInfo<'info>,

    /// The treasury's WSOL token account (receives withdrawn funds)
    #[account(
        mut,
        constraint = treasury_wsol_ata.owner == ecosystem_streaming_treasury.key() @ ContentRegistryError::InvalidOwner,
        constraint = treasury_wsol_ata.mint == NATIVE_MINT @ ContentRegistryError::InvalidMint
    )]
    pub treasury_wsol_ata: Account<'info, TokenAccount>,

    /// The Streamflow stream metadata account
    /// CHECK: Validated by Streamflow program
    #[account(mut)]
    pub stream_metadata: AccountInfo<'info>,

    /// The escrow token account holding streamed funds
    /// CHECK: PDA derived by Streamflow program
    #[account(mut)]
    pub escrow_tokens: Account<'info, TokenAccount>,

    /// Streamflow treasury for their fee
    /// CHECK: Known Streamflow account
    #[account(mut, address = STREAMFLOW_TREASURY)]
    pub streamflow_treasury: AccountInfo<'info>,

    /// Streamflow treasury WSOL account
    #[account(mut)]
    pub streamflow_treasury_wsol: Account<'info, TokenAccount>,

    /// Partner account (same as what was used in create)
    /// CHECK: Must match partner in stream metadata
    #[account(mut)]
    pub partner: AccountInfo<'info>,

    /// Partner WSOL account
    #[account(mut)]
    pub partner_wsol: Account<'info, TokenAccount>,

    /// WSOL mint
    #[account(address = WSOL_MINT)]
    pub wsol_mint: Account<'info, Mint>,

    /// Streamflow program
    /// CHECK: Verified by address
    #[account(address = STREAMFLOW_PROGRAM_ID)]
    pub streamflow_program: AccountInfo<'info>,

    /// Anyone can call this to trigger withdrawal
    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

/// Withdraw accumulated funds from Streamflow stream to ecosystem treasury
/// This pulls all available (released) funds from the stream escrow to treasury's WSOL ATA
pub fn handle_withdraw_ecosystem_stream_to_treasury(
    ctx: Context<WithdrawEcosystemStreamToTreasury>,
) -> Result<()> {
    msg!("Withdrawing from Streamflow stream to ecosystem treasury");

    // Get treasury PDA bump for signing
    let (_, treasury_bump) = Pubkey::find_program_address(
        &[ECOSYSTEM_STREAMING_TREASURY_SEED],
        &crate::ID
    );
    let treasury_seeds = &[ECOSYSTEM_STREAMING_TREASURY_SEED, &[treasury_bump]];
    let treasury_signer = &[&treasury_seeds[..]];

    // Build Streamflow withdraw CPI
    // Treasury PDA is the recipient of the stream, so it can withdraw
    let cpi_accounts = StreamflowWithdraw {
        authority: ctx.accounts.ecosystem_streaming_treasury.to_account_info(), // Recipient signs
        recipient: ctx.accounts.ecosystem_streaming_treasury.to_account_info(),
        recipient_tokens: ctx.accounts.treasury_wsol_ata.to_account_info(),
        metadata: ctx.accounts.stream_metadata.to_account_info(),
        escrow_tokens: ctx.accounts.escrow_tokens.to_account_info(),
        streamflow_treasury: ctx.accounts.streamflow_treasury.to_account_info(),
        streamflow_treasury_tokens: ctx.accounts.streamflow_treasury_wsol.to_account_info(),
        partner: ctx.accounts.partner.to_account_info(),
        partner_tokens: ctx.accounts.partner_wsol.to_account_info(),
        mint: ctx.accounts.wsol_mint.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
    };

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.streamflow_program.to_account_info(),
        cpi_accounts,
        treasury_signer,
    );

    // Withdraw all available funds (u64::MAX = withdraw max available)
    streamflow_sdk::cpi::withdraw(cpi_ctx, u64::MAX)?;

    msg!("Successfully withdrew from stream to ecosystem treasury WSOL ATA");
    msg!("Treasury WSOL balance now: {}", ctx.accounts.treasury_wsol_ata.amount);

    Ok(())
}

/// Withdraw accumulated WSOL from Streamflow stream to creator patron treasury
#[derive(Accounts)]
pub struct WithdrawCreatorStreamToTreasury<'info> {
    /// The creator whose patron treasury receives the funds
    /// CHECK: Used as PDA seed
    pub creator: AccountInfo<'info>,

    /// The creator's patron streaming treasury PDA (stream recipient)
    /// CHECK: PDA verified by seeds
    #[account(
        mut,
        seeds = [CREATOR_PATRON_TREASURY_SEED, creator.key().as_ref()],
        bump
    )]
    pub creator_patron_treasury: AccountInfo<'info>,

    /// The treasury's WSOL token account
    #[account(
        mut,
        constraint = treasury_wsol_ata.owner == creator_patron_treasury.key() @ ContentRegistryError::InvalidOwner,
        constraint = treasury_wsol_ata.mint == NATIVE_MINT @ ContentRegistryError::InvalidMint
    )]
    pub treasury_wsol_ata: Account<'info, TokenAccount>,

    /// The Streamflow stream metadata account
    /// CHECK: Validated by Streamflow program
    #[account(mut)]
    pub stream_metadata: AccountInfo<'info>,

    /// The escrow token account holding streamed funds
    /// CHECK: PDA derived by Streamflow program
    #[account(mut)]
    pub escrow_tokens: Account<'info, TokenAccount>,

    /// Streamflow treasury for their fee
    /// CHECK: Known Streamflow account
    #[account(mut, address = STREAMFLOW_TREASURY)]
    pub streamflow_treasury: AccountInfo<'info>,

    /// Streamflow treasury WSOL account
    #[account(mut)]
    pub streamflow_treasury_wsol: Account<'info, TokenAccount>,

    /// Partner account
    /// CHECK: Must match partner in stream metadata
    #[account(mut)]
    pub partner: AccountInfo<'info>,

    /// Partner WSOL account
    #[account(mut)]
    pub partner_wsol: Account<'info, TokenAccount>,

    /// WSOL mint
    #[account(address = WSOL_MINT)]
    pub wsol_mint: Account<'info, Mint>,

    /// Streamflow program
    /// CHECK: Verified by address
    #[account(address = STREAMFLOW_PROGRAM_ID)]
    pub streamflow_program: AccountInfo<'info>,

    /// Anyone can call this
    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

/// Withdraw accumulated funds from Streamflow stream to creator patron treasury
pub fn handle_withdraw_creator_stream_to_treasury(
    ctx: Context<WithdrawCreatorStreamToTreasury>,
) -> Result<()> {
    msg!("Withdrawing from Streamflow stream to creator patron treasury");

    // Get treasury PDA bump for signing
    let creator_key = ctx.accounts.creator.key();
    let (_, treasury_bump) = Pubkey::find_program_address(
        &[CREATOR_PATRON_TREASURY_SEED, creator_key.as_ref()],
        &crate::ID
    );
    let treasury_seeds: &[&[u8]] = &[CREATOR_PATRON_TREASURY_SEED, creator_key.as_ref(), &[treasury_bump]];
    let treasury_signer = &[treasury_seeds];

    // Build Streamflow withdraw CPI
    let cpi_accounts = StreamflowWithdraw {
        authority: ctx.accounts.creator_patron_treasury.to_account_info(),
        recipient: ctx.accounts.creator_patron_treasury.to_account_info(),
        recipient_tokens: ctx.accounts.treasury_wsol_ata.to_account_info(),
        metadata: ctx.accounts.stream_metadata.to_account_info(),
        escrow_tokens: ctx.accounts.escrow_tokens.to_account_info(),
        streamflow_treasury: ctx.accounts.streamflow_treasury.to_account_info(),
        streamflow_treasury_tokens: ctx.accounts.streamflow_treasury_wsol.to_account_info(),
        partner: ctx.accounts.partner.to_account_info(),
        partner_tokens: ctx.accounts.partner_wsol.to_account_info(),
        mint: ctx.accounts.wsol_mint.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
    };

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.streamflow_program.to_account_info(),
        cpi_accounts,
        treasury_signer,
    );

    // Withdraw all available funds (u64::MAX = withdraw max available)
    streamflow_sdk::cpi::withdraw(cpi_ctx, u64::MAX)?;

    msg!("Successfully withdrew from stream to creator patron treasury WSOL ATA");

    Ok(())
}
