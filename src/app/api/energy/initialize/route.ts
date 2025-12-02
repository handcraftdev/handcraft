import { auth } from '@/auth';
import { EnergyRepository } from '@/repositories/energy.repository';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/energy/initialize - Initialize energy for a user
 * This is used to create energy data for a user if they don't have it yet
 */
export async function POST(_req: NextRequest) {
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
    
    // Initialize energy repository
    const energyRepo = new EnergyRepository();
    
    // Check if user already has energy data
    const existingEnergy = await energyRepo.getUserEnergy(walletAddress);
    
    if (existingEnergy) {
      return NextResponse.json({
        success: true,
        message: 'Energy data already exists',
        energy: {
          amount: existingEnergy.energyAmount,
          max: existingEnergy.maxEnergy
        }
      });
    }
    
    // Initialize energy for the user
    const success = await energyRepo.initializeUserEnergy(walletAddress);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to initialize energy' }, 
        { status: 500 }
      );
    }
    
    // Get the newly created energy data
    const newEnergy = await energyRepo.getUserEnergy(walletAddress);
    
    return NextResponse.json({
      success: true,
      message: 'Energy initialized successfully',
      energy: newEnergy ? {
        amount: newEnergy.energyAmount,
        max: newEnergy.maxEnergy
      } : null
    });
  } catch (error) {
    console.error('Error in energy initialization route:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}