'use server';

import { createSupabaseServerClient } from '@/utils/supabase';

export interface TransactionData {
  transactionId: string;
  reference?: string;
  amount: number;
  token: string;
  recipient: string;
  status: 'pending' | 'completed' | 'failed';
}

/**
 * Records a new transaction
 * 
 * @param userId User ID from Supabase
 * @param transactionData Transaction data to record
 * @returns The recorded transaction
 */
export async function recordTransaction(userId: string, transactionData: TransactionData) {
  const supabase = createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      transaction_id: transactionData.transactionId,
      reference: transactionData.reference,
      amount: transactionData.amount,
      token: transactionData.token,
      recipient: transactionData.recipient,
      status: transactionData.status
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error recording transaction:', error);
    throw new Error(`Failed to record transaction: ${error.message}`);
  }
  
  return data;
}

/**
 * Updates a transaction's status
 * 
 * @param transactionId Transaction ID to update
 * @param status New status
 * @returns Updated transaction
 */
export async function updateTransactionStatus(transactionId: string, status: 'pending' | 'completed' | 'failed') {
  const supabase = createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('transactions')
    .update({
      status
    })
    .eq('transaction_id', transactionId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating transaction status:', error);
    throw new Error(`Failed to update transaction status: ${error.message}`);
  }
  
  return data;
}

/**
 * Gets a user's transaction history
 * 
 * @param userId User ID from Supabase
 * @param limit Optional limit of transactions to return
 * @param offset Optional offset for pagination
 * @returns List of transactions
 */
export async function getTransactionHistory(userId: string, limit = 10, offset = 0) {
  const supabase = createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) {
    console.error('Error fetching transaction history:', error);
    throw new Error(`Failed to fetch transaction history: ${error.message}`);
  }
  
  return data;
}

/**
 * Gets a specific transaction by ID
 * 
 * @param transactionId Transaction ID to get
 * @returns Transaction data or null if not found
 */
export async function getTransaction(transactionId: string) {
  const supabase = createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('transaction_id', transactionId)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 is the "no rows returned" error
    console.error('Error fetching transaction:', error);
    throw new Error(`Failed to fetch transaction: ${error.message}`);
  }
  
  return data;
}