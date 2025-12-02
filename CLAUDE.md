# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a World App Mini App template for building applications that run inside the World App ecosystem. This template uses Next.js 15 and provides integration with Worldcoin's authentication, verification, payment, and transaction systems.

## Key Technologies

- Next.js 15
- Next Auth for authentication
- Worldcoin Minikit for wallet authentication, verification, payments, and transactions
- World App Mini Apps UI Kit for styling

## Environment Setup

Before running the application, you need to create and configure an `.env.local` file:

1. Copy `.env.example` to `.env.local` (or create it if it doesn't exist)
2. Generate an AUTH_SECRET with `npx auth secret` and add it to `.env.local`
3. Configure the following variables:
   - `NEXT_PUBLIC_APP_ID`: Your Mini App ID from developer.worldcoin.org
   - `HMAC_SECRET_KEY`: Secret for hashing nonces
   - `NEXTAUTH_SECRET`: Auth secret for NextAuth
   - `AUTH_URL`: Base URL of your app (for authentication callbacks)
   - `NEXT_PUBLIC_VERIFY_ACTION_ID`: General verification action ID
   - `NEXT_PUBLIC_VERIFY_ACTION_ROCK`: Rock move verification action ID
   - `NEXT_PUBLIC_VERIFY_ACTION_PAPER`: Paper move verification action ID
   - `NEXT_PUBLIC_VERIFY_ACTION_SCISSORS`: Scissors move verification action ID

## Development Commands

```
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint
```

## External Tools Required

- ngrok for exposing localhost during development: `ngrok http 3000`

## Application Architecture

1. **Authentication Flow**:
   - Uses Worldcoin's wallet authentication via `@worldcoin/minikit-js`
   - NextAuth session management with JWT strategy
   - Protected routes in `src/app/(protected)/*`

2. **Core Components**:
   - `AuthButton`: Handles wallet authentication
   - `Verify`: Handles World ID verification (Device or Orb)
   - `Pay`: Demonstrates payment functionality
   - `Transaction`: Shows smart contract interaction
   - `ViewPermissions`: Shows available permissions

3. **API Routes**:
   - `/api/auth/[...nextauth]`: NextAuth authentication endpoints
   - `/api/verify-proof`: Server-side verification of World ID proofs
   - `/api/initiate-payment`: Creates payment references for transactions

## Important Development Notes

1. For World ID verification to work:
   - Create verification actions in the developer portal
   - Configure the action in the `Verify` component
   - For Rock Paper Scissors game, create three separate verification actions:
     - One for rock moves (`NEXT_PUBLIC_VERIFY_ACTION_ROCK`)
     - One for paper moves (`NEXT_PUBLIC_VERIFY_ACTION_PAPER`)
     - One for scissors moves (`NEXT_PUBLIC_VERIFY_ACTION_SCISSORS`)

2. For transactions to work:
   - Add contract addresses to contract entrypoints in the developer portal
   - Configure permit2 tokens if using permit2

3. For production:
   - Disable the Eruda console in production by modifying the Eruda provider

4. Update your domain:
   - Add your development domain to `allowedDevOrigins` in `next.config.ts`
   - Make sure your app is properly configured in developer.worldcoin.org