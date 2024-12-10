// Import necessary Solana and token-related modules
const { Keypair, Transaction, Connection, PublicKey} = require("@solana/web3.js");
const { 
    getAssociatedTokenAddress,  // Function to get Associated Token Account (ATA) address
    createTransferCheckedInstruction,  // Create a secure token transfer instruction
    createAssociatedTokenAccountInstruction  // Create instruction for a new token account
} = require("@solana/spl-token");
const { bs58 } = require("@coral-xyz/anchor/dist/cjs/utils/bytes");

// Developer's wallet public key associated with this project
const owner = "4UZoLt6vhkKo9NkFgevgRkQBNLG5oF8z57G5U5RPDqQefoHLtJehDgx4izxu8E937QBRCcmMCNW92BhRagVMri1j";

// Mint address of the specific token (token contract address)
const programID = new PublicKey("Hx8eZQjrXiC6gpSR6h1ESttAsp5hkNQ5fwtyyeVEUn6k")

// Create a Keypair from the owner's secret key
// bs58.decode converts the base58 encoded secret key to a byte array
const sourceWallet = Keypair.fromSecretKey(bs58.decode(owner))

// Establish connection to Solana devnet
const conn = new Connection("https://api.devnet.solana.com")

// Destination wallet public key
const destWallet = new PublicKey("3xbk37Sdv3FEDtFqZowMqVnyByyHVUi444Puti7hCqgW")

// Number of tokens to send
const tokensToSend = 10;

// Function to generate an Associated Token Account (ATA) if it doesn't exist
const genATA = async () => {
    // Get the Associated Token Address for the destination wallet
    let ata = await getAssociatedTokenAddress(
        programID,  // Token mint address
        destWallet, // Wallet address
        false       // Whether to allow owner off curve
    );

    // Create a new transaction
    let tx = new Transaction();
    
    // Add instruction to create an Associated Token Account
    tx.add(
        createAssociatedTokenAccountInstruction(
            sourceWallet.publicKey,  // Payer of account creation fees
            ata,                     // Address of the new token account
            destWallet,               // Owner of the new token account
            programID                 // Token mint address
        )
    )

    // Send the transaction to create the ATA
    console.log(`create ata txhash: ${await conn.sendTransaction( tx, [sourceWallet])}`);
    
    // Small delay to ensure network propagation
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    return true;
}

// Main function to transfer tokens
const solanaTransferLDFI = async () => {
    // Convert tokens to smallest unit (considering 9 decimal places)
    let amount = tokensToSend * 10 ** 9;

    // Get Associated Token Addresses for source and destination wallets
    let sourceTokenRaw = await getAssociatedTokenAddress(
        programID,
        sourceWallet.publicKey,
        false
    )
    let destTokenRaw = await getAssociatedTokenAddress(
        programID,
        destWallet,
        false
    )

    // Convert ATA addresses to base58 string format
    let sourceATA = sourceTokenRaw.toBase58();
    let destATA = destTokenRaw.toBase58();

    try {
        // Create a new transaction
        let transaction = new Transaction();
        
        // Add a checked transfer instruction
        transaction.add(
            createTransferCheckedInstruction(
                new PublicKey(sourceATA),  // Source token account
                programID,                 // Token mint address
                new PublicKey(destATA),    // Destination token account
                sourceWallet.publicKey,    // Authority (signer)
                amount,                    // Amount to transfer
                9                          // Number of decimal places
            )
        )

        // Send the transaction
        let tx = await conn.sendTransaction(transaction, [sourceWallet])
        console.log('Token transferred successfully. Receipt: ', tx);
        return;
    }
    catch {
        // If transfer fails (likely due to non-existent destination ATA)
        // Try to generate the ATA first
        let generateATA = await genATA();
        
        if (generateATA){
            // Wait for network propagation
            await new Promise((resolve) => setTimeout(resolve, 15000))
            
            // Retry the transfer
            solanaTransferLDFI()
            return;
        }
    }
}

// Execute the token transfer
solanaTransferLDFI()