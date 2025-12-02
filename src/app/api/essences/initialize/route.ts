import { auth } from '@/auth';
import { ElementalEssencesRepository } from '@/repositories/elemental-essences.repository';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/essences/initialize - Initialize essences for a user
 * This is used to create essences data for a user if they don't have it yet
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
    
    // Get user ID from session
    const userId = session.user.supabaseId || session.user.walletAddress || session.user.id;
    
    // Initialize essences repository
    const essencesRepo = new ElementalEssencesRepository();
    
    // Check if user already has essences data
    const existingEssences = await essencesRepo.getUserEssences(userId);
    
    if (existingEssences) {
      return NextResponse.json({
        success: true,
        message: 'Essences data already exists',
        essences: {
          rock: existingEssences.rockEssence,
          paper: existingEssences.paperEssence,
          scissors: existingEssences.scissorsEssence
        }
      });
    }
    
    // Initialize essences for the user
    const success = await essencesRepo.initializeUserEssences(userId);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to initialize essences' }, 
        { status: 500 }
      );
    }
    
    // Get the newly created essences data
    const newEssences = await essencesRepo.getUserEssences(userId);
    
    return NextResponse.json({
      success: true,
      message: 'Essences initialized successfully',
      essences: newEssences ? {
        rock: newEssences.rockEssence,
        paper: newEssences.paperEssence,
        scissors: newEssences.scissorsEssence
      } : null
    });
  } catch (error) {
    console.error('Error in essences initialization route:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}