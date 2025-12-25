use anchor_lang::prelude::*;

// Re-export Tribunalcraft types needed for CPI
pub use tribunalcraft::{
    cpi::accounts::CreateSubject as CreateSubjectCpi,
    cpi::create_subject as tribunalcraft_create_subject,
    program::Tribunalcraft,
    state::{Subject, Dispute, Escrow, DefenderPool, DefenderRecord},
    constants::{SUBJECT_SEED, DISPUTE_SEED, ESCROW_SEED, DEFENDER_POOL_SEED, DEFENDER_RECORD_SEED},
};

// Handcraft namespace seed for deriving Tribunalcraft subject IDs
// This ensures Handcraft content subjects are unique to our platform
pub const HANDCRAFT_SEED: &[u8] = b"handcraft";

// Default moderation settings for content subjects
pub const DEFAULT_MATCH_MODE: bool = true;  // Match mode: bond_at_risk = min(stake, bond)
pub const DEFAULT_VOTING_PERIOD: i64 = 1 * 24 * 60 * 60;  // 1 day in seconds
pub const DEFAULT_INITIAL_BOND: u64 = 0;  // No initial bond required (creator can add later)

/// Derive a deterministic subject ID from content CID
/// This creates a Pubkey from sha256(HANDCRAFT_SEED || sha256(content_cid))
/// ensuring each content has a unique, deterministic subject ID
pub fn derive_subject_id(content_cid: &str, tribunalcraft_program_id: &Pubkey) -> (Pubkey, u8) {
    let cid_hash = solana_sha256_hasher::hash(content_cid.as_bytes());
    Pubkey::find_program_address(
        &[HANDCRAFT_SEED, cid_hash.as_ref()],
        tribunalcraft_program_id,
    )
}

/// Accounts required for Tribunalcraft subject creation via CPI
/// These accounts must be passed alongside the normal content registration accounts
#[derive(Accounts)]
pub struct TribunalcraftSubjectAccounts<'info> {
    /// The Tribunalcraft program for CPI
    pub tribunalcraft_program: Program<'info, Tribunalcraft>,

    /// Subject account to be initialized (PDA: [SUBJECT_SEED, subject_id])
    /// CHECK: Initialized by Tribunalcraft CPI
    #[account(mut)]
    pub tc_subject: UncheckedAccount<'info>,

    /// Dispute account to be initialized (PDA: [DISPUTE_SEED, subject_id])
    /// CHECK: Initialized by Tribunalcraft CPI
    #[account(mut)]
    pub tc_dispute: UncheckedAccount<'info>,

    /// Escrow account to be initialized (PDA: [ESCROW_SEED, subject_id])
    /// CHECK: Initialized by Tribunalcraft CPI
    #[account(mut)]
    pub tc_escrow: UncheckedAccount<'info>,

    /// Defender pool (PDA: [DEFENDER_POOL_SEED, creator.key()])
    /// CHECK: Initialized or loaded by Tribunalcraft CPI
    #[account(mut)]
    pub tc_defender_pool: UncheckedAccount<'info>,

    /// Defender record for round 0 (PDA: [DEFENDER_RECORD_SEED, subject_id, creator.key(), 0u32])
    /// CHECK: Initialized by Tribunalcraft CPI
    #[account(mut)]
    pub tc_defender_record: UncheckedAccount<'info>,
}

/// Execute CPI to Tribunalcraft's create_subject instruction
/// This atomically creates the moderation subject when content is registered
pub fn create_tribunalcraft_subject<'info>(
    tribunalcraft_program: &AccountInfo<'info>,
    creator: &AccountInfo<'info>,
    subject: &AccountInfo<'info>,
    dispute: &AccountInfo<'info>,
    escrow: &AccountInfo<'info>,
    defender_pool: &AccountInfo<'info>,
    defender_record: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    subject_id: Pubkey,
    details_cid: &str,
    initial_bond: u64,
) -> Result<()> {
    // Build CPI accounts
    let cpi_accounts = CreateSubjectCpi {
        creator: creator.clone(),
        subject: subject.clone(),
        dispute: dispute.clone(),
        escrow: escrow.clone(),
        defender_pool: defender_pool.clone(),
        defender_record: defender_record.clone(),
        system_program: system_program.clone(),
    };

    let cpi_ctx = CpiContext::new(tribunalcraft_program.clone(), cpi_accounts);

    // Call Tribunalcraft create_subject with moderation settings
    // details_cid contains content metadata (title, description, etc.)
    tribunalcraft_create_subject(
        cpi_ctx,
        subject_id,
        details_cid.to_string(),
        DEFAULT_MATCH_MODE,
        DEFAULT_VOTING_PERIOD,
        initial_bond,
    )?;

    msg!("Created Tribunalcraft subject with details: {}", details_cid);
    Ok(())
}

/// Verify that the provided subject accounts match the expected PDAs for the given subject_id
pub fn verify_subject_pdas(
    subject_id: &Pubkey,
    creator: &Pubkey,
    tc_subject: &Pubkey,
    tc_dispute: &Pubkey,
    tc_escrow: &Pubkey,
    tc_defender_pool: &Pubkey,
    tc_defender_record: &Pubkey,
    tribunalcraft_program_id: &Pubkey,
) -> Result<()> {
    // Verify subject PDA
    let (expected_subject, _) = Pubkey::find_program_address(
        &[SUBJECT_SEED, subject_id.as_ref()],
        tribunalcraft_program_id,
    );
    require_keys_eq!(*tc_subject, expected_subject, TribunalcraftCpiError::InvalidSubjectPda);

    // Verify dispute PDA
    let (expected_dispute, _) = Pubkey::find_program_address(
        &[DISPUTE_SEED, subject_id.as_ref()],
        tribunalcraft_program_id,
    );
    require_keys_eq!(*tc_dispute, expected_dispute, TribunalcraftCpiError::InvalidDisputePda);

    // Verify escrow PDA
    let (expected_escrow, _) = Pubkey::find_program_address(
        &[ESCROW_SEED, subject_id.as_ref()],
        tribunalcraft_program_id,
    );
    require_keys_eq!(*tc_escrow, expected_escrow, TribunalcraftCpiError::InvalidEscrowPda);

    // Verify defender pool PDA
    let (expected_defender_pool, _) = Pubkey::find_program_address(
        &[DEFENDER_POOL_SEED, creator.as_ref()],
        tribunalcraft_program_id,
    );
    require_keys_eq!(*tc_defender_pool, expected_defender_pool, TribunalcraftCpiError::InvalidDefenderPoolPda);

    // Verify defender record PDA (round 0)
    let (expected_defender_record, _) = Pubkey::find_program_address(
        &[
            DEFENDER_RECORD_SEED,
            subject_id.as_ref(),
            creator.as_ref(),
            &0u32.to_le_bytes(),
        ],
        tribunalcraft_program_id,
    );
    require_keys_eq!(*tc_defender_record, expected_defender_record, TribunalcraftCpiError::InvalidDefenderRecordPda);

    Ok(())
}

#[error_code]
pub enum TribunalcraftCpiError {
    #[msg("Invalid Tribunalcraft subject PDA")]
    InvalidSubjectPda,
    #[msg("Invalid Tribunalcraft dispute PDA")]
    InvalidDisputePda,
    #[msg("Invalid Tribunalcraft escrow PDA")]
    InvalidEscrowPda,
    #[msg("Invalid Tribunalcraft defender pool PDA")]
    InvalidDefenderPoolPda,
    #[msg("Invalid Tribunalcraft defender record PDA")]
    InvalidDefenderRecordPda,
}
