"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

const SESSION_STORAGE_KEY = "handcraft_session";

interface StoredSession {
  token: string;
  wallet: string;
  expiresAt: number;
}

interface SessionState {
  token: string | null;
  isValid: boolean;
  isCreating: boolean;
}

/**
 * Hook for managing user sessions
 * Sessions are created after signing and stored in localStorage
 */
export function useSession() {
  const { publicKey, signMessage, connected } = useWallet();
  const [session, setSession] = useState<SessionState>({
    token: null,
    isValid: false,
    isCreating: false,
  });

  // Load session from storage on mount and when wallet changes
  useEffect(() => {
    if (!publicKey) {
      setSession({ token: null, isValid: false, isCreating: false });
      return;
    }

    const walletAddress = publicKey.toBase58();
    const stored = getStoredSession();

    if (stored && stored.wallet === walletAddress && stored.expiresAt > Date.now()) {
      setSession({ token: stored.token, isValid: true, isCreating: false });
    } else {
      // Clear invalid/expired session
      clearStoredSession();
      setSession({ token: null, isValid: false, isCreating: false });
    }
  }, [publicKey]);

  // Create a new session by signing
  const createSession = useCallback(async (): Promise<string | null> => {
    if (!publicKey || !signMessage) {
      return null;
    }

    setSession((prev) => ({ ...prev, isCreating: true }));

    try {
      const walletAddress = publicKey.toBase58();
      const timestamp = Date.now().toString();
      const message = `Handcraft Session\nTimestamp: ${timestamp}`;
      const messageBytes = new TextEncoder().encode(message);

      // Prompt user to sign
      const signatureBytes = await signMessage(messageBytes);
      const signature = Buffer.from(signatureBytes).toString("base64");

      // Call API to create session
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, signature, timestamp }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      const { token, expiresIn } = await response.json();
      const expiresAt = Date.now() + expiresIn;

      // Store session
      storeSession({ token, wallet: walletAddress, expiresAt });
      setSession({ token, isValid: true, isCreating: false });

      return token;
    } catch (error) {
      console.error("Failed to create session:", error);
      setSession((prev) => ({ ...prev, isCreating: false }));
      return null;
    }
  }, [publicKey, signMessage]);

  // Clear the current session
  const clearSession = useCallback(() => {
    clearStoredSession();
    setSession({ token: null, isValid: false, isCreating: false });
  }, []);

  // Get or create session (returns existing if valid, creates new if not)
  const getOrCreateSession = useCallback(async (): Promise<string | null> => {
    if (session.isValid && session.token) {
      return session.token;
    }
    return createSession();
  }, [session.isValid, session.token, createSession]);

  return {
    token: session.token,
    isValid: session.isValid,
    isCreating: session.isCreating,
    createSession,
    clearSession,
    getOrCreateSession,
    needsSession: connected && !session.isValid,
  };
}

// Storage helpers
function getStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function storeSession(session: StoredSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage might be full or disabled
  }
}

function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
