# Test Wallets for Subscription System Testing

## Wallet Addresses

| Role | Address |
|------|---------|
| creator1 | 36EnxH5NpHmYR4Jf3jy8WVHfjbB2QNTHwb3WuJBqjcvK |
| creator2 | 61TDABUWN1mf1HXsNUKskb9MEFCtkzTX7UCDbfTWrdib |
| subscriber1 | 342Cz3adQKSM94iY48ywHjo6vi8J5JmnEdqz7mvouEJa |
| subscriber2 | 8mcKsQP2uagf379VcQJo3hZEvPfAAVEaxyWawfwK5nJ8 |
| subscriber3 | EhJnDWzLn31fd9o4Tb2wVm8BRarBRKCERSURRM3nuVC4 |
| minter1 | 5vHpa36kk3nPnFBEdEkekJA7JAxsSHNsoceQJhEqdPSf |
| minter2 | HRqwTBYj6Ycn69ptjvyKxxckBmXZsbC6Ve38N77bQZFT |
| claimer1 | BVQ2np8m3AWSrFw9X5f3iCjXYqxYX8aTicVkjgcZUPMj |

## Keypair Files

Each wallet's secret key is stored in `{role}.json` in this directory.
Format: JSON array of 64 bytes (standard Solana keypair format)

## Funding Status

Fund at: https://faucet.solana.com (limit: ~2 SOL per 8 hours per IP)

## Usage

Load a wallet in TypeScript:
```typescript
import { Keypair } from "@solana/web3.js";
import * as fs from "fs";

const secretKey = JSON.parse(fs.readFileSync("scripts/test-wallets/creator1.json", "utf-8"));
const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
```
