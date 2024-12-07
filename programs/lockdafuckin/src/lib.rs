use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
        Metadata as Metaplex,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};
declare_id!("DaAEZvCbrdJ7WADHrmtPSY2rmW6R4c5iZ43PsfxVabYy");

#[program]
pub mod lockdafuckin {
    use super::*;

    /// The function to initialize the token mint and its metadata.
    ///
    /// This function performs all necessary steps to create a token and
    /// register its metadata with the Metaplex Token Metadata Program.
    pub fn initiate_token(ctx: Context<InitiateToken>, metadata: InitTokenParams) -> Result<()> {
        // PDA seeds for the mint account
        let seeds = &["mint".as_bytes(), &[ctx.bumps.mint]]; // Derives PDA using seed "mint" and bump seed
        let signer = [&seeds[..]]; // Wraps seeds in the required format for signers

        // Define the token metadata structure
        let token_data: DataV2 = DataV2 {
            name: metadata.name,        // Name of the token (from params)
            symbol: metadata.symbol,    // Symbol of the token (from params)
            uri: metadata.uri,          // Metadata URI (from params)
            seller_fee_basis_points: 0, // No royalty fees specified
            creators: None,             // No specific creators set
            collection: None,           // No collection linked
            uses: None,                 // No usage constraints
        };

        // Create the CPI (Cross-Program Invocation) context for creating metadata
        let metadata_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(), // Metadata program account
            CreateMetadataAccountsV3 {
                payer: ctx.accounts.payer.to_account_info(), // Payer funding the transaction
                update_authority: ctx.accounts.mint.to_account_info(), // Update authority set to mint
                mint: ctx.accounts.mint.to_account_info(),             // Mint account
                metadata: ctx.accounts.metadata.to_account_info(),     // Metadata account
                mint_authority: ctx.accounts.mint.to_account_info(),   // Mint authority
                system_program: ctx.accounts.system_program.to_account_info(), // System program account
                rent: ctx.accounts.rent.to_account_info(), // Rent sysvar account
            },
            &signer, // Signer for the mint PDA
        );

        // Create the metadata account using the Metaplex program
        create_metadata_accounts_v3(metadata_ctx, token_data, true, true, None)?;

        // Log success message
        msg!("Token mint created successfully!");

        Ok(()) // Return success
    }

    pub fn mint_tokens(ctx: Context<MintTokens>, quantity: u64) -> Result<()> {
        // Create the seeds used for deriving the address for the mint authority.
        // The seeds are a combination of the "mint" string and the bump value from the context.
        // These seeds help in deriving a unique, valid address for the mint account.
        let seeds = &["mint".as_bytes(), &[ctx.bumps.mint]];

        // The signer is constructed by using the seeds. This will be used in the CPI to authorize the minting process.
        let signer = [&seeds[..]];

        // Perform the minting operation using the `mint_to` CPI function from the Solana Token Program.
        mint_to(
            // Create a new CPI context with the necessary accounts and signer.
            CpiContext::new_with_signer(
                // The Solana token program account info. This is required to interact with the token program.
                ctx.accounts.token_program.to_account_info(),
                // The MintTo struct defines the accounts involved in minting the tokens.
                MintTo {
                    // The authority that is allowed to mint the tokens. This is the mint account.
                    authority: ctx.accounts.mint.to_account_info(),

                    // The destination account where the minted tokens will be sent.
                    to: ctx.accounts.destination.to_account_info(),

                    // The mint account associated with the token type being minted.
                    mint: ctx.accounts.mint.to_account_info(),
                },
                // The signer is passed to authorize the minting transaction.
                &signer,
            ),
            // The quantity of tokens to mint is provided as an argument.
            quantity,
        )?;

        // Return Ok to indicate that the operation was successful.
        Ok(())
    }
}
/// Instruction to initialize a new token mint and its metadata.
///
/// The `#[instruction(params: InitTokenParams)]` directive ensures
/// that the `params` are passed alongside the instruction call.
#[derive(Accounts)]
#[instruction(params: InitTokenParams)]
pub struct InitiateToken<'info> {
    /// The metadata account for the token.
    /// CHECK: This account is managed by the Metaplex Token Metadata Program, which enforces its own checks.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// The mint account being created for the token.
    /// This account is derived programmatically using a PDA (Program Derived Address).
    #[account(
        init, // This attribute initializes the mint account.
        seeds = [b"mint"], // Seed to derive the PDA for the mint account.
        bump, // Auto-calculates the bump seed for PDA derivation.
        payer = payer, // Specifies the payer account funding the creation.
        mint::decimals = params.decimals, // Sets the token's precision (number of decimals).
        mint::authority = mint, // Specifies the authority of the mint (mint in this case).
    )]
    pub mint: Account<'info, Mint>,

    /// The account paying for the transaction fees and account creation.
    /// This must be mutable because SOL will be debited from this account.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Rent sysvar account to ensure the new accounts are rent-exempt.
    pub rent: Sysvar<'info, Rent>,

    /// Solana System Program for account creation and other low-level operations.
    pub system_program: Program<'info, System>,

    /// Token Program, used to initialize and manage token-related operations.
    pub token_program: Program<'info, Token>,

    /// Metaplex Token Metadata Program for managing token metadata.
    pub token_metadata_program: Program<'info, Metaplex>,
}

#[derive(Accounts)] // This macro is used to define the accounts required for the operation
pub struct MintTokens<'info> {
    // The `mint` account represents the mint that will be used to create the tokens.
    #[account(
        mut,  // This means the `mint` account will be modified during the transaction.
        seeds = [b"mint"],  // This defines the seed to find the mint's address.
        bump,  // The `bump` ensures the mint's address is valid (part of address derivation in Solana).
        mint::authority = mint  // The mint's authority must match the `mint` account.
    )]
    pub mint: Account<'info, Mint>,

    // The `destination` account represents the user's token account where minted tokens will go.
    #[account(
        init_if_needed,  // Initialize the `destination` account only if it doesn't exist yet.
        payer = payer,  // The `payer` will cover the fees for creating the `destination` account.
        associated_token::mint = mint,  // This associates the `destination` account with the `mint` account.
        associated_token::authority = payer,  // The `payer` must have authority over the `destination` account.
    )]
    pub destination: Account<'info, TokenAccount>,

    #[account(mut)] // This means the `payer` account will be modified during the transaction.
    pub payer: Signer<'info>, // The `Signer` trait indicates this account(payer) must sign the transaction.

    pub rent: Sysvar<'info, Rent>, // This provides access to the rent sysvar, which is used to determine if accounts are rent-exempt.

    pub system_program: Program<'info, System>, // This is required for managing basic accounts in Solana.

    pub token_program: Program<'info, Token>, // This program is needed to manage SPL tokens.

    pub associated_token_program: Program<'info, AssociatedToken>, // This program is required to work with associated token accounts.
}

/// Parameters for the `InitToken` instruction.
///
/// These parameters are passed by the client during the transaction.
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct InitTokenParams {
    /// The name of the token
    pub name: String,

    /// The symbol of the token
    pub symbol: String,

    /// URI pointing to the token's metadata
    pub uri: String,

    /// The number of decimal places for the token.
    pub decimals: u8,
}
