import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/utils/supabase';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const requestData = await request.json();
    const { paymentType, tier, description } = requestData;

    // Validate request data
    if (!paymentType || !['energy', 'leagueEntry'].includes(paymentType)) {
      return NextResponse.json({ error: 'Invalid payment type' }, { status: 400 });
    }
    
    // Validate tier for energy payments
    if (paymentType === 'energy' && (!tier || !['small', 'medium', 'large'].includes(tier))) {
      return NextResponse.json({ error: 'Invalid energy tier' }, { status: 400 });
    }

    // Generate a unique ID for the transaction
    const transactionId = crypto.randomUUID().replace(/-/g, '');
    
    // Get user ID from session (using supabaseId which is in UUID format)
    const userId = session.user.supabaseId;

    // Check that we have a valid UUID for the user
    if (!userId) {
      console.error('No supabaseId found in user session');
      return NextResponse.json({ error: 'User not properly authenticated' }, { status: 401 });
    }
    
    // Connect to Supabase
    const supabase = createSupabaseServerClient();
    
    // Store payment info in database for later verification
    const { error } = await supabase.from('payments').insert({
      transaction_id: transactionId,
      user_id: userId,
      payment_type: paymentType,
      tier: tier || null,
      description: description || '',
      status: 'pending'
    });

    if (error) {
      console.error('Error storing payment information:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Return the transaction ID for the frontend to use
    return NextResponse.json({ id: transactionId });
  } catch (error) {
    console.error('Error initiating payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}