'use server';

import { createSupabaseServerClient } from '@/utils/supabase';

export interface VerificationData {
  verificationLevel: string;
  action: string;
  nullifierHash?: string;
}

/**
 * Records a new verification
 * 
 * @param userId User ID from Supabase
 * @param verificationData Verification data to record
 * @returns The recorded verification
 */
export async function recordVerification(userId: string, verificationData: VerificationData) {
  const supabase = createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('verifications')
    .insert({
      user_id: userId,
      verification_level: verificationData.verificationLevel,
      action: verificationData.action,
      nullifier_hash: verificationData.nullifierHash
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error recording verification:', error);
    throw new Error(`Failed to record verification: ${error.message}`);
  }
  
  return data;
}

/**
 * Checks if a user has been verified for a specific action
 * 
 * @param userId User ID from Supabase
 * @param action Action to check
 * @param verificationLevel Optional verification level to check
 * @returns True if verified, false otherwise
 */
export async function isVerified(userId: string, action: string, verificationLevel?: string) {
  const supabase = createSupabaseServerClient();
  
  let query = supabase
    .from('verifications')
    .select('*')
    .eq('user_id', userId)
    .eq('action', action);
  
  if (verificationLevel) {
    query = query.eq('verification_level', verificationLevel);
  }
  
  const { data, error } = await query.limit(1);
  
  if (error) {
    console.error('Error checking verification:', error);
    throw new Error(`Failed to check verification: ${error.message}`);
  }
  
  return data && data.length > 0;
}

/**
 * Gets all verifications for a user
 * 
 * @param userId User ID from Supabase
 * @returns List of verifications
 */
export async function getUserVerifications(userId: string) {
  const supabase = createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('verifications')
    .select('*')
    .eq('user_id', userId)
    .order('verified_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching user verifications:', error);
    throw new Error(`Failed to fetch user verifications: ${error.message}`);
  }
  
  return data;
}