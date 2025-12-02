use anchor_lang::prelude::*;

declare_id!("25WLThAnXWyNZcTLJpXkx6Gh7b7Go9DNNiZrZdWEKabi");

#[program]
pub mod content_registry {
    use super::*;

    /// Create a new creator profile
    pub fn create_profile(ctx: Context<CreateProfile>, username: String) -> Result<()> {
        require!(username.len() <= 32, ErrorCode::UsernameTooLong);

        let profile = &mut ctx.accounts.profile;
        profile.authority = ctx.accounts.authority.key();
        profile.username = username;
        profile.content_count = 0;
        profile.total_tips = 0;
        profile.created_at = Clock::get()?.unix_timestamp;

        Ok(())
    }

    /// Publish new content
    pub fn create_content(
        ctx: Context<CreateContent>,
        content_cid: String,
        metadata_cid: String,
        content_type: ContentType,
    ) -> Result<()> {
        require!(content_cid.len() <= 64, ErrorCode::CidTooLong);
        require!(metadata_cid.len() <= 64, ErrorCode::CidTooLong);

        let content = &mut ctx.accounts.content;
        let profile = &mut ctx.accounts.profile;

        content.creator = ctx.accounts.authority.key();
        content.content_cid = content_cid;
        content.metadata_cid = metadata_cid;
        content.content_type = content_type;
        content.tips_received = 0;
        content.created_at = Clock::get()?.unix_timestamp;
        content.index = profile.content_count;

        profile.content_count += 1;

        Ok(())
    }

    /// Tip a creator for their content
    pub fn tip_content(ctx: Context<TipContent>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidTipAmount);

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

        // Update stats
        let content = &mut ctx.accounts.content;
        let profile = &mut ctx.accounts.profile;

        content.tips_received += amount;
        profile.total_tips += amount;

        emit!(TipEvent {
            content: content.key(),
            tipper: ctx.accounts.tipper.key(),
            creator: ctx.accounts.creator.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Update content metadata (creator only)
    pub fn update_content(ctx: Context<UpdateContent>, metadata_cid: String) -> Result<()> {
        require!(metadata_cid.len() <= 64, ErrorCode::CidTooLong);

        let content = &mut ctx.accounts.content;
        content.metadata_cid = metadata_cid;

        Ok(())
    }
}

// === Accounts ===

#[derive(Accounts)]
#[instruction(username: String)]
pub struct CreateProfile<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + CreatorProfile::INIT_SPACE,
        seeds = [b"profile", authority.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, CreatorProfile>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(content_cid: String, metadata_cid: String, content_type: ContentType)]
pub struct CreateContent<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ContentEntry::INIT_SPACE,
        seeds = [b"content", authority.key().as_ref(), &profile.content_count.to_le_bytes()],
        bump
    )]
    pub content: Account<'info, ContentEntry>,

    #[account(
        mut,
        seeds = [b"profile", authority.key().as_ref()],
        bump,
        has_one = authority
    )]
    pub profile: Account<'info, CreatorProfile>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TipContent<'info> {
    #[account(mut)]
    pub content: Account<'info, ContentEntry>,

    #[account(
        mut,
        seeds = [b"profile", creator.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, CreatorProfile>,

    /// CHECK: Creator wallet to receive tips
    #[account(mut, constraint = content.creator == creator.key())]
    pub creator: AccountInfo<'info>,

    #[account(mut)]
    pub tipper: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateContent<'info> {
    #[account(
        mut,
        has_one = creator @ ErrorCode::Unauthorized
    )]
    pub content: Account<'info, ContentEntry>,

    /// CHECK: Verified via has_one constraint
    pub creator: Signer<'info>,
}

// === State ===

#[account]
#[derive(InitSpace)]
pub struct CreatorProfile {
    pub authority: Pubkey,
    #[max_len(32)]
    pub username: String,
    pub content_count: u64,
    pub total_tips: u64,
    pub created_at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct ContentEntry {
    pub creator: Pubkey,
    #[max_len(64)]
    pub content_cid: String,
    #[max_len(64)]
    pub metadata_cid: String,
    pub content_type: ContentType,
    pub tips_received: u64,
    pub created_at: i64,
    pub index: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ContentType {
    Video,
    Audio,
    Image,
    Post,
    Stream,
}

// === Events ===

#[event]
pub struct TipEvent {
    pub content: Pubkey,
    pub tipper: Pubkey,
    pub creator: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

// === Errors ===

#[error_code]
pub enum ErrorCode {
    #[msg("Username must be 32 characters or less")]
    UsernameTooLong,
    #[msg("CID must be 64 characters or less")]
    CidTooLong,
    #[msg("Tip amount must be greater than 0")]
    InvalidTipAmount,
    #[msg("Unauthorized")]
    Unauthorized,
}
