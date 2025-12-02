import { hashNonce } from '@/auth/wallet/client-helpers';
import { createOrUpdateUser } from '@/repositories/user.repository';
import {
  MiniAppWalletAuthSuccessPayload,
  MiniKit,
  verifySiweMessage,
} from '@worldcoin/minikit-js';
import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

declare module 'next-auth' {
  interface User {
    id: string;
    walletAddress: string;
    username: string;
    profilePictureUrl: string;
    supabaseId?: string; // Added to track Supabase user ID
  }

  interface Session {
    user: {
      walletAddress: string;
      username: string;
      profilePictureUrl: string;
      supabaseId?: string; // Added to track Supabase user ID
    } & DefaultSession['user'];
  }
}

// Auth configuration for Wallet Auth based sessions
// For more information on each option (and a full list of options) go to
// https://authjs.dev/getting-started/authentication/credentials
export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'World App Wallet',
      credentials: {
        nonce: { label: 'Nonce', type: 'text' },
        signedNonce: { label: 'Signed Nonce', type: 'text' },
        finalPayloadJson: { label: 'Final Payload', type: 'text' },
      },
      // @ts-expect-error TODO
      authorize: async ({
        nonce,
        signedNonce,
        finalPayloadJson,
      }: {
        nonce: string;
        signedNonce: string;
        finalPayloadJson: string;
      }) => {
        try {
          // Verify the signed nonce
          const expectedSignedNonce = hashNonce({ nonce });
          if (signedNonce !== expectedSignedNonce) {
            console.log('Invalid signed nonce');
            return null;
          }

          // Parse and verify the SIWE message
          const finalPayload: MiniAppWalletAuthSuccessPayload =
            JSON.parse(finalPayloadJson);
          const result = await verifySiweMessage(finalPayload, nonce);

          if (!result.isValid || !result.siweMessageData.address) {
            console.log('Invalid final payload');
            return null;
          }

          // Get user info from World App
          const userInfo = await MiniKit.getUserInfo(finalPayload.address);
          
          // Store or update user in Supabase
          const supabaseUser = await createOrUpdateUser({
            walletAddress: finalPayload.address,
            username: userInfo.username,
            profilePictureUrl: userInfo.profilePictureUrl
          });

          // Return the authenticated user with Supabase ID
          return {
            id: finalPayload.address,
            ...userInfo,
            supabaseId: supabaseUser?.id
          };
        } catch (error) {
          console.error('Error in authentication:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.walletAddress = user.walletAddress;
        token.username = user.username;
        token.profilePictureUrl = user.profilePictureUrl;
        token.supabaseId = user.supabaseId;
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.walletAddress = token.walletAddress as string;
        session.user.username = token.username as string;
        session.user.profilePictureUrl = token.profilePictureUrl as string;
        session.user.supabaseId = token.supabaseId as string;
      }

      return session;
    },
  },
});
