import { useEffect, useCallback, createContext, useContext, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';

// Create a single Supabase client instance for auth (singleton)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton Supabase client - created once at module level
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return supabaseClient;
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
 */
export function SupabaseAuthProvider({ children }: SupabaseAuthProviderProps) {
  const wallet = useWallet();
  const supabase = getSupabaseClient();
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });

  // Track if we've attempted sign-in for this wallet connection
  const signInAttempted = useRef(false);
  const lastWalletAddress = useRef<string | null>(null);
  // Track if wallet was ever connected (to distinguish page refresh from actual disconnect)
  const walletWasConnected = useRef(false);

  // Sign in with Web3 wallet (native Supabase Web3 auth)
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
      console.log('[SupabaseAuth] Signing in with wallet:', wallet.publicKey.toBase58());

      const { data, error } = await supabase.auth.signInWithWeb3({
        chain: 'solana',
        statement: 'Sign in to Handcraft',
        wallet: wallet as any,
      });

      if (error) throw error;

      console.log('[SupabaseAuth] Web3 sign in successful:', data.user?.id);
      // Auth state will be updated by onAuthStateChange listener
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

      // Clear local state
      setAuthState({
        user: null,
        session: null,
        loading: false,
        error: null,
      });

      console.log('[SupabaseAuth] Signed out');
    } catch (err) {
      console.error('[SupabaseAuth] Sign out failed:', err);
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to sign out',
      }));
    }
  }, [supabase]);

  // Initialize auth state from existing session
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false,
          error: null,
        });
      } catch (err) {
        console.error('[SupabaseAuth] Failed to get session:', err);
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: null,
        }));
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[SupabaseAuth] Auth state changed:', event, session?.user?.id);
        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false,
          error: null,
        });
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Auto sign-in when wallet connects (if no existing session)
  useEffect(() => {
    const walletAddress = wallet.publicKey?.toBase58() ?? null;

    // Reset sign-in attempt tracker if wallet changes
    if (walletAddress !== lastWalletAddress.current) {
      signInAttempted.current = false;
      lastWalletAddress.current = walletAddress;
    }

    // Auto sign-in when wallet connects and not already authenticated
    if (
      wallet.connected &&
      wallet.publicKey &&
      !authState.loading &&
      !authState.session &&
      !signInAttempted.current
    ) {
      console.log('[SupabaseAuth] Auto-signing in with wallet:', wallet.publicKey.toBase58());
      signInAttempted.current = true;
      signIn();
    }
  }, [wallet.connected, wallet.publicKey, authState.loading, authState.session, signIn]);

  // Track when wallet connects
  useEffect(() => {
    if (wallet.connected) {
      walletWasConnected.current = true;
    }
  }, [wallet.connected]);

  // Sign out when wallet disconnects (only if it was previously connected)
  useEffect(() => {
    if (!wallet.connected && authState.session && walletWasConnected.current) {
      console.log('[SupabaseAuth] Wallet disconnected, signing out');
      walletWasConnected.current = false;
      signOut();
    }
  }, [wallet.connected, authState.session, signOut]);

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
