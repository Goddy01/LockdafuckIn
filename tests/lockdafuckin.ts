import * as anchor from "@coral-xyz/anchor";
import assert from "assert"; // Assertion library for testing
import { Program } from "@coral-xyz/anchor";
import { Lockdafuckin } from "../target/types/lockdafuckin";
import * as web3 from "@solana/web3.js"; // Web3 utilities for Solana
import BN from "bn.js";

describe("lockdafuckin", () => {
  // Configure the Anchor client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env()); // Use the environment's Solana cluster configuration

  // Load the program from the workspace
  const program = anchor.workspace.Lockdafuckin as anchor.Program<Lockdafuckin>;

  // Constants for token metadata and addresses
  const METADATA_SEED = "metadata"; // Seed for metadata address derivation
  const TOKEN_METADATA_PROGRAM_ID = new web3.PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s" // Token metadata program public key
  );
  const MINT_SEED = "mint"; // Seed for mint address derivation

  // The public key of the payer (creator of the token)
  const payer = program.provider.publicKey;

  // Metadata for the SPL token
  const metadata = {
    name: "Lock Da Fuck In", // Token name
    symbol: "LDFI", // Token symbol
    uri: "https://purple-cheap-bobcat-47.mypinata.cloud/ipfs/QmaKgNN99tr4RzVjnBypv7fU9BvR4KeWwqJKzT7tBmLfsE", // Metadata JSON URI
    decimals: 9, // Token decimal places
  };

  const mintAmount = 1233900; // Number of tokens to mint

  // Derive the mint address using the program ID and seed
  const [mint] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from(MINT_SEED)], // Seed buffer
    program.programId // Program ID
  );

  // Derive the metadata address using its program ID, seed, and mint address
  const [metadataAddress] = web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(METADATA_SEED), // Metadata seed buffer
      TOKEN_METADATA_PROGRAM_ID.toBuffer(), // Token metadata program public key
      mint.toBuffer(), // Mint address buffer
    ],
    TOKEN_METADATA_PROGRAM_ID // Token metadata program ID
  );

  // Test case for initializing the token
  it("Initiate Token", async () => {
    // Check if the mint account already exists
    const info = await program.provider.connection.getAccountInfo(mint);
    if (info) {
      return; // Skip initialization if the mint already exists
    }
    console.log("  Mint not found. Initializing program....");

    // Context for initializing the token
    const context = {
      metadata: metadataAddress, // Metadata account
      mint, // Mint account
      payer, // Payer public key
      rent: web3.SYSVAR_RENT_PUBKEY, // Rent system variable account
      systemProgram: web3.SystemProgram.programId, // System program ID
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID, // Token program ID
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID, // Token metadata program ID
    };

    // Call the `initiateToken` method on the program
    const txHash = await program.methods.initiateToken(metadata).accounts(context).rpc();

    // Confirm the transaction
    await program.provider.connection.confirmTransaction(txHash, "finalized");
    console.log(`https://explorer.solana.com/tx/${txHash}?cluster=devnet`);

    // Verify that the mint account is now initialized
    const newInfo = await program.provider.connection.getAccountInfo(mint);
    assert(newInfo, " Mint should be initialized");
  });

  // Test case for minting tokens
  it("Mint Tokens", async () => {
    // Derive the associated token account for the payer
    const destination = await anchor.utils.token.associatedAddress({
      mint: mint, // Mint address
      owner: payer, // Owner's public key
    });

    let initialBalance: number;

    // Fetch the initial balance of the associated token account
    try {
      const balance = await program.provider.connection.getTokenAccountBalance(destination);
      initialBalance = balance.value.uiAmount;
    } catch {
      // If the account doesn't exist, set the balance to 0
      initialBalance = 0;
    }

    // Context for minting tokens
    const context = {
      mint, // Mint account
      destination, // Associated token account
      payer, // Payer public key
      rent: web3.SYSVAR_RENT_PUBKEY, // Rent system variable account
      systemProgram: web3.SystemProgram.programId, // System program ID
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID, // Token program ID
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID, // Associated token program ID
    };

    // Call the `mintTokens` method on the program with the mint amount
    const txHash = await program.methods
      .mintTokens(new BN(mintAmount * 10 ** metadata.decimals)) // Convert to smallest unit using decimals
      .accounts(context)
      .rpc();

    // Confirm the transaction
    await program.provider.connection.confirmTransaction(txHash);
    console.log(`  https://explorer.solana.com/tx/${txHash}?cluster=devnet`);

    // Fetch the post-mint balance and assert correctness
    const postBalance = (
      await program.provider.connection.getTokenAccountBalance(destination)
    ).value.uiAmount;
    assert.equal(
      initialBalance + mintAmount, // Expected balance
      postBalance, // Actual balance
      "Post balance should equal initial plus mint amount"
    );
  });
});
