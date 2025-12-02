import { auth } from '@/auth';
import { EnergyRepository } from '@/repositories/energy.repository';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/energy/consume - Consume energy for an action
 */
export async function POST(req: NextRequest) {
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
    
    // Get wallet address from session
    const walletAddress = session.user.walletAddress || session.user.id;
    
    // Parse the request body
    const body = await req.json();
    const { amount = 1 } = body;
    
    // Validate amount
    if (typeof amount !== 'number' || amount < 1) {
      return NextResponse.json(
        { error: 'Invalid amount' }, 
        { status: 400 }
      );
    }
    
    // Initialize energy repository
    const energyRepo = new EnergyRepository();
    
    // Consume energy
    const result = await energyRepo.consumeEnergy(walletAddress, amount);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Insufficient energy', remainingEnergy: result.remainingEnergy }, 
        { status: 403 }
      );
    }
    
    // Return updated energy data
    return NextResponse.json({
      success: true,
      remainingEnergy: result.remainingEnergy,
      nextEnergyAt: result.nextEnergyAt
    });
  } catch (error) {
    console.error('Error in energy consumption route:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}