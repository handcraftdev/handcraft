import { auth } from '@/auth';
import { getUserByWalletAddress } from '@/repositories/user.repository';
import { createSupabaseServerClient } from '@/utils/supabase';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/energy/debug - Debug endpoint to check energy system
 * Only available in development mode
 */
export async function GET(_req: NextRequest) {
  // Only allow this endpoint in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  
  try {
    // Get the authenticated session
    const session = await auth();
    
    // Check if user is authenticated
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      );
    }
    
    // Get info from session
    const walletAddress = session.user.walletAddress || session.user.id;
    const userId = session.user.id;
    const supabaseId = session.user.supabaseId;
    
    // Initialize Supabase client
    const supabase = createSupabaseServerClient();
    
    // Get user from database
    const user = await getUserByWalletAddress(walletAddress);
    
    // Check if user has energy record
    const { data: energyData, error: energyError } = await supabase
      .from('energy')
      .select('*')
      .eq('user_id', user?.id || '')
      .single();
    
    if (energyError && energyError.code !== 'PGRST116') { // Not found is ok
      // Error fetching energy data
    }
    
    // Return debug info
    return NextResponse.json({
      session: {
        userId,
        walletAddress,
        supabaseId
      },
      user: user || null,
      energy: energyData || null,
      hasEnergyRecord: !!energyData,
      token: {
        energy_user_id: user?.id || null,
        wallet_address: walletAddress
      }
    });
  } catch (_error) {
    // Error in energy debug route
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}