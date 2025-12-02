import { auth } from '@/auth';
import { ElementalEssencesRepository } from '@/repositories/elemental-essences.repository';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/essences/use - Use essences for a user
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
    
    // Get user ID from session
    const userId = session.user.supabaseId || session.user.walletAddress || session.user.id;
    
    // Parse the request body
    const body = await req.json();
    const { type, amount = 1, walletId } = body;
    
    // Validate type
    if (!type || !['rock', 'paper', 'scissors'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid essence type' }, 
        { status: 400 }
      );
    }
    
    // Validate amount
    if (typeof amount !== 'number' || amount < 1) {
      return NextResponse.json(
        { error: 'Invalid amount' }, 
        { status: 400 }
      );
    }
    
    // Initialize essences repository
    const essencesRepo = new ElementalEssencesRepository();
    
    // Use essence - use provided walletId if available, otherwise use session userId
    const targetUserId = walletId || userId;
    const result = await essencesRepo.useEssence(targetUserId, type, amount);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Insufficient essence', remainingAmount: result.remainingAmount }, 
        { status: 403 }
      );
    }
    
    // Return updated essences data
    return NextResponse.json({
      success: true,
      remainingAmount: result.remainingAmount
    });
  } catch (error) {
    console.error('Error in essence use route:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}