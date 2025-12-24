import { useEffect, useCallback, createContext, useContext, useState, useMemo, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';

// Helper to safely convert PublicKey to base58 (handles prototype loss during SSR/hydration)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safePublicKeyToBase58(pk: any): string | null {
  if (!pk) return null;
  try {
    if (pk instanceof PublicKey) {
      return pk.toBase58();
    }
    if (typeof pk.toBase58 === 'function') {
      return pk.toBase58();
    }
    // Reconstruct if prototype was lost
    if (pk._bn) {
      return new PublicKey(pk._bn.toArray()).toBase58();
    }
    return null;
  } catch {
    return null;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cache clients per wallet to avoid "Multiple GoTrueClient instances" warning
const clientCache = new Map<string, SupabaseClient>();

// Get or create a Supabase client with per-wallet storage key for session isolation
function getSupabaseClientForWallet(walletAddress: string | null): SupabaseClient {
  const cacheKey = walletAddress || 'anonymous';

  if (!clientCache.has(cacheKey)) {
    const storageKey = walletAddress
      ? `sb-handcraft-auth-${walletAddress}`
      : 'sb-handcraft-auth-anonymous';

    clientCache.set(cacheKey, createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey,
      },
    }));
  }

  return clientCache.get(cacheKey)!;
}

// Auth state interface
interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

// Context value interface
interface SupabaseAuthContextValue extends AuthState {
  supabase: SupabaseClient;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

// Create context
const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(null);

/**
 * Hook to use Supabase authentication with Solana wallet
 */
export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
}

/**
 * Provider component props
 */
interface SupabaseAuthProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that manages Supabase auth state with native Web3 auth
 * Each wallet gets isolated session storage to prevent cross-wallet session contamination
 */
export function SupabaseAuthProvider({ children }: SupabaseAuthProviderProps) {
  const wallet = useWallet();
  const walletAddress = safePublicKeyToBase58(wallet.publicKey);

  // Track previous wallet to detect changes
  const prevWalletRef = useRef<string | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Get cached client for current wallet
  const supabase = useMemo(() => {
    // Clean up previous subscription when wallet changes
    if (prevWalletRef.current !== walletAddress && subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    prevWalletRef.current = walletAddress;

    const client = getSupabaseClientForWallet(walletAddress);
    clientRef.current = client;
    return client;
  }, [walletAddress]);

  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });

  // Sign in with Web3 wallet
  const signIn = useCallback(async () => {
    if (!wallet.connected || !wallet.publicKey) {
      setAuthState(prev => ({
        ...prev,
        error: 'Please connect your wallet first',
      }));
      return;
    }

    setAuthState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Get the wallet adapter - try standard wallet first, then Phantom
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const walletAdapter = (window as any).solana || (window as any).phantom?.solana;

      if (!walletAdapter) {
        throw new Error('No Solana wallet found. Please install Phantom or another Solana wallet.');
      }

      // Ensure the wallet is connected
      if (!walletAdapter.isConnected && walletAdapter.connect) {
        await walletAdapter.connect();
      }
      const { data, error } = await supabase.auth.signInWithWeb3({
        chain: 'solana',
        statement: 'Sign in to Handcraft',
        wallet: walletAdapter,
      });

      if (error) throw error;

      // Manually update auth state if session is returned
      if (data?.session) {
        setAuthState({
          user: data.session.user,
          session: data.session,
          loading: false,
          error: null,
        });
      }
    } catch (err) {
      console.error('[SupabaseAuth] Sign in failed:', err);
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to sign in',
      }));
    }
  }, [wallet, supabase]);

  // Sign out
  const signOut = useCallback(async () => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('[SupabaseAuth] Supabase signOut error:', error);
      }

      setAuthState({
        user: null,
        session: null,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('[SupabaseAuth] Sign out failed:', err);
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to sign out',
      }));
    }
  }, [supabase]);

  // Track current session to avoid redundant updates
  const currentSessionRef = useRef<string | null>(null);

  // Initialize auth state and listen for changes
  useEffect(() => {
    let isMounted = true;

    // Helper to update state only if session actually changed
    const updateSession = (session: Session | null, forceUpdate = false) => {
      const sessionId = session?.access_token || null;
      // Skip if same session, unless forcing update (for initial load)
      if (currentSessionRef.current === sessionId && !forceUpdate) return;
      currentSessionRef.current = sessionId;

      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false,
        error: null,
      });
    };

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      updateSession(session, true); // Force update on initial load
    }).catch(err => {
      console.error('[SupabaseAuth] getSession error:', err);
      if (isMounted) {
        setAuthState(prev => ({ ...prev, loading: false, error: 'Failed to get session' }));
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        // Skip INITIAL_SESSION if we already have a session (SIGNED_IN already fired)
        if (event === 'INITIAL_SESSION' && currentSessionRef.current) return;
        updateSession(session);
      }
    );

    subscriptionRef.current = subscription;

    return () => {
      isMounted = false;
      currentSessionRef.current = null;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Auto sign-in when wallet connects and no session exists
  const hasAttemptedAutoSignIn = useRef(false);
  useEffect(() => {
    // Only attempt auto sign-in once per wallet connection
    if (
      wallet.connected &&
      wallet.publicKey &&
      !authState.session &&
      !authState.loading &&
      !hasAttemptedAutoSignIn.current
    ) {
      hasAttemptedAutoSignIn.current = true;
      signIn();
    }

    // Reset the flag when wallet disconnects
    if (!wallet.connected) {
      hasAttemptedAutoSignIn.current = false;
    }
  }, [wallet.connected, wallet.publicKey, authState.session, authState.loading, signIn]);

  const value: SupabaseAuthContextValue = {
    ...authState,
    supabase,
    signIn,
    signOut,
    isAuthenticated: !!authState.session,
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

// Re-export for convenience
export { SupabaseAuthContext };
