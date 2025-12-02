import { createClient } from '@supabase/supabase-js';

// Types for our database schema
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Database schema types - we'll expand this as we define tables
export interface Database {
  public: {
    Tables: {
      elemental_essences: {
        Row: {
          id: string;
          user_id: string;
          rock_essence: number;
          paper_essence: number;
          scissors_essence: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          rock_essence?: number;
          paper_essence?: number;
          scissors_essence?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          rock_essence?: number;
          paper_essence?: number;
          scissors_essence?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      energy: {
        Row: {
          id: string;
          user_id: string;
          energy_amount: number;
          last_consumed_at: string | null;
          last_refreshed_at: string | null;
          energy_replenish_rate: number;
          max_energy: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          energy_amount?: number;
          last_consumed_at?: string | null;
          last_refreshed_at?: string | null;
          energy_replenish_rate?: number;
          max_energy?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          energy_amount?: number;
          last_consumed_at?: string | null;
          last_refreshed_at?: string | null;
          energy_replenish_rate?: number;
          max_energy?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          wallet_address: string;
          username: string | null;
          created_at: string;
          updated_at: string;
          profile_picture_url: string | null;
        };
        Insert: {
          id?: string;
          wallet_address: string;
          username?: string | null;
          created_at?: string;
          updated_at?: string;
          profile_picture_url?: string | null;
        };
        Update: {
          id?: string;
          wallet_address?: string;
          username?: string | null;
          created_at?: string;
          updated_at?: string;
          profile_picture_url?: string | null;
        };
      };
      permissions: {
        Row: {
          id: string;
          user_id: string;
          notifications: boolean;
          contacts: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          notifications?: boolean;
          contacts?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          notifications?: boolean;
          contacts?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          transaction_id: string;
          reference: string | null;
          amount: number;
          token: string;
          recipient: string;
          created_at: string;
          status: 'pending' | 'completed' | 'failed';
        };
        Insert: {
          id?: string;
          user_id: string;
          transaction_id: string;
          reference?: string | null;
          amount: number;
          token: string;
          recipient: string;
          created_at?: string;
          status?: 'pending' | 'completed' | 'failed';
        };
        Update: {
          id?: string;
          user_id?: string;
          transaction_id?: string;
          reference?: string | null;
          amount?: number;
          token?: string;
          recipient?: string;
          created_at?: string;
          status?: 'pending' | 'completed' | 'failed';
        };
      };
      verifications: {
        Row: {
          id: string;
          user_id: string;
          verification_level: string;
          action: string;
          verified_at: string;
          nullifier_hash: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          verification_level: string;
          action: string;
          verified_at?: string;
          nullifier_hash?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          verification_level?: string;
          action?: string;
          verified_at?: string;
          nullifier_hash?: string | null;
        };
      };
    };
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
  };
}

// Singleton instance for browser to prevent multiple instances
let browserClientInstance: ReturnType<typeof createClient<Database>> | null = null;

// Create the client for browser usage (client-side)
// Using env variables with NEXT_PUBLIC_ prefix for client-side safety
export const createSupabaseBrowserClient = () => {
  // Default values for build-time safety
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

  // In server environment during build, return a placeholder client
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production' && (!supabaseUrl || !supabaseAnonKey)) {
    // This prevents build errors but won't be used at runtime
    return createClient<Database>('https://placeholder-url.supabase.co', 'placeholder-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  // In server environment, always create a new instance
  if (typeof window === 'undefined') {
    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  // In browser environment, use singleton pattern
  if (!browserClientInstance) {
    browserClientInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false // Disable auto refresh to prevent stack overflow
      }
    });
  }

  return browserClientInstance;
};

// Server client instance - always created fresh
export const createSupabaseServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

  // In build environment, provide placeholder client that won't be used at runtime
  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false, // Disable auto refresh to prevent stack overflow
    },
  });
};

// Single-use client for server components
// WARNING: This client shouldn't be used to query data in server components with sensitive data
// Use server actions instead
export const supabase = createSupabaseBrowserClient();