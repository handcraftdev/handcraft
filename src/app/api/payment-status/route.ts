import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/utils/supabase';
import { auth } from '@/auth';

/**
 * GET endpoint to check payment transaction status
 */
export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the transaction ID from query parameters
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Missing transaction ID' },
        { status: 400 }
      );
    }

    // Get user ID from session
    const userId = session.user.supabaseId || session.user.id;
    
    // Connect to Supabase
    const supabase = createSupabaseServerClient();
    
    // Fetch the payment record from the database
    const { data: paymentRecord, error: fetchError } = await supabase
      .from('payments')
      .select('status, created_at, updated_at')
      .eq('transaction_id', transactionId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching payment record:', fetchError);
      return NextResponse.json(
        { error: 'Payment record not found' },
        { status: 404 }
      );
    }

    // Return the payment status
    return NextResponse.json({
      transactionId,
      status: paymentRecord.status,
      created_at: paymentRecord.created_at,
      updated_at: paymentRecord.updated_at
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}