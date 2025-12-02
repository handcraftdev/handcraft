'use server';

import { createSupabaseServerClient } from '@/utils/supabase';

export interface UserData {
  walletAddress: string;
  username?: string | null;
  profilePictureUrl?: string | null;
}

/**
 * Creates a new user or updates an existing user after wallet authentication
 * 
 * @param userData User data from wallet authentication
 * @returns The created or updated user
 */
export async function createOrUpdateUser(userData: UserData) {
  const supabase = createSupabaseServerClient();
  
  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', userData.walletAddress)
    .single();
  
  if (existingUser) {
    // Update existing user
    const { data, error } = await supabase
      .from('users')
      .update({
        username: userData.username,
        profile_picture_url: userData.profilePictureUrl,
        updated_at: new Date().toISOString()
      })
      .eq('wallet_address', userData.walletAddress)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating user:', error);
      throw new Error(`Failed to update user: ${error.message}`);
    }
    
    return data;
  } else {
    // Create new user
    const { data, error } = await supabase
      .from('users')
      .insert({
        wallet_address: userData.walletAddress,
        username: userData.username,
        profile_picture_url: userData.profilePictureUrl
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating user:', error);
      throw new Error(`Failed to create user: ${error.message}`);
    }
    
    return data;
  }
}

/**
 * Retrieves a user by their wallet address
 * 
 * @param walletAddress The wallet address to look up
 * @returns The user data or null if not found
 */
export async function getUserByWalletAddress(walletAddress: string) {
  const supabase = createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 is the "no rows returned" error
    console.error('Error fetching user:', error);
    throw new Error(`Failed to fetch user: ${error.message}`);
  }
  
  return data;
}

/**
 * Updates a user's profile information
 * 
 * @param walletAddress The wallet address of the user to update
 * @param userData The updated user data
 * @returns The updated user
 */
export async function updateUserProfile(walletAddress: string, userData: Partial<UserData>) {
  const supabase = createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('users')
    .update({
      username: userData.username,
      profile_picture_url: userData.profilePictureUrl,
      updated_at: new Date().toISOString()
    })
    .eq('wallet_address', walletAddress)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating user profile:', error);
    throw new Error(`Failed to update user profile: ${error.message}`);
  }
  
  return data;
}