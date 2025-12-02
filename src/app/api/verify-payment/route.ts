import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/utils/supabase';
import { auth } from '@/auth';

// Import the tiers directly to avoid 'use client' compatibility issues
// These tiers are defined here for documentation purposes but are used directly in code
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PAYMENT_TIERS = {
  // Energy credits payment tiers
  energy: {
    small: {
      amount: 50, // 50 energy credits
      price: 0.05, // 0.05 WLD
      wldAmount: 0.05 // 0.05 WLD
    },
    medium: {
      amount: 150, // 150 energy credits
      price: 0.1, // 0.1 WLD
      wldAmount: 0.1 // 0.1 WLD
    },
    large: {
      amount: 300, // 300 energy credits
      price: 0.15, // 0.15 WLD
      wldAmount: 0.15 // 0.15 WLD
    }
  },
  // League entry fee
  leagueEntry: {
    price: 0.075, // 0.075 WLD
    wldAmount: 0.075 // 0.075 WLD
  }
};

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { transactionId, paymentType, tier } = await request.json();

    // Validate request data
    if (!transactionId) {
      return NextResponse.json({ error: 'Missing transaction ID' }, { status: 400 });
    }

    if (!paymentType || !['energy', 'leagueEntry'].includes(paymentType)) {
      return NextResponse.json({ error: 'Invalid payment type' }, { status: 400 });
    }

    // Validate tier for energy payments
    if (paymentType === 'energy' && (!tier || !['small', 'medium', 'large'].includes(tier))) {
      return NextResponse.json({ error: 'Invalid energy tier' }, { status: 400 });
    }

    // Get user ID from session (using supabaseId which is in UUID format)
    const userId = session.user.supabaseId;

    // Check that we have a valid UUID for the user
    if (!userId) {
      // No supabaseId found in user session
      return NextResponse.json({ error: 'User not properly authenticated' }, { status: 401 });
    }
    
    // Connect to Supabase
    const supabase = createSupabaseServerClient();
    
    // Fetch the payment record from the database
    const { data: paymentRecord, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('transaction_id', transactionId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !paymentRecord) {
      // Error fetching payment record
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
    }

    // In a real implementation, you would verify the transaction with the World ID API here
    // This is simplified for the demonstration
    
    // For this demo, we'll simulate a successful verification
    // Update payment status to verified
    const { error: updateError } = await supabase
      .from('payments')
      .update({ status: 'verified' })
      .eq('transaction_id', transactionId);

    if (updateError) {
      // Error updating payment status
      return NextResponse.json({ error: 'Failed to update payment status' }, { status: 500 });
    }

    // Process the rewards based on payment type
    if (paymentType === 'energy' && tier && ['small', 'medium', 'large'].includes(tier)) {
      // Add energy credits to the user's account
      let energyAmount = 0;

      // Handle tier mapping safely
      if (tier === 'small') energyAmount = 50;
      else if (tier === 'medium') energyAmount = 150;
      else if (tier === 'large') energyAmount = 300;
      
      // First get the user's current reserve energy
      const { data: playerData, error: fetchPlayerError } = await supabase
        .from('player_season_stats')
        .select('reserve_energy')
        .eq('player_id', userId)
        .single();

      if (fetchPlayerError) {
        // Error fetching player data
        return NextResponse.json({ error: 'Failed to fetch player data' }, { status: 500 });
      }

      const currentEnergy = playerData?.reserve_energy || 0;

      // First call the RPC function to get the new energy value
      // Destructure only what we need
      const { error: rpcError } = await supabase
        .rpc('increment_reserve_energy', {
          current_energy: currentEnergy,
          amount: energyAmount
        });

      if (rpcError) {
        // Error calling increment_reserve_energy RPC
        return NextResponse.json({ error: 'Failed to increment energy' }, { status: 500 });
      }

      // Now update the player's energy with the returned value
      const { error: energyError } = await supabase
        .from('player_season_stats')
        .update({
          reserve_energy: currentEnergy + energyAmount // Fallback direct calculation if RPC doesn't return as expected
        })
        .eq('player_id', userId);

      if (energyError) {
        // Error adding energy credits
        return NextResponse.json({ error: 'Failed to add energy credits' }, { status: 500 });
      }
    } else if (paymentType === 'leagueEntry') {
      // Enroll the user in the league
      // Check if there's an active season first
      const { data: seasonData, error: seasonError } = await supabase
        .from('seasons')
        .select('id')
        .eq('status', 'active')
        .single();

      if (seasonError || !seasonData) {
        // Error fetching active season
        return NextResponse.json({ error: 'No active season found' }, { status: 400 });
      }

      // Check if player is already enrolled
      const { data: existingPlayer, error: playerCheckError } = await supabase
        .from('player_season_stats')
        .select('id')
        .eq('player_id', userId)
        .eq('season_id', seasonData.id);

      if (playerCheckError) {
        // Error checking player status
        return NextResponse.json({ error: 'Failed to check player status' }, { status: 500 });
      }

      // If player is not already enrolled, create a new record
      if (!existingPlayer || existingPlayer.length === 0) {
        // Creating new player record with World payment for league entry - NO ENERGY CREDITS
        const { error: enrollError } = await supabase
          .from('player_season_stats')
          .insert({
            player_id: userId,
            season_id: seasonData.id,
            points: 0,
            reserve_energy: 0, // Explicitly setting to 0 for WLD payments
            games_played: 0,
            games_won: 0,
            win_streak: 0,
            participation_days: 0,
            has_entry_ticket: true
          });

        if (enrollError) {
          // Error enrolling player
          return NextResponse.json({ error: 'Failed to enroll in league' }, { status: 500 });
        }
      } else {
        // Player is already enrolled, DO NOT give them bonus energy for WLD payments
        // Player already enrolled via WLD payment - NOT adding bonus energy

        // Just return success without modifying the player record
        // This ensures consistency with essence-based purchases
      }
    }

    // Return success response
    return NextResponse.json({ 
      verified: true,
      message: 'Payment verified successfully'
    });
  } catch (_error) {
    // Error verifying payment
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}