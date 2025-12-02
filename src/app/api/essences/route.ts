import { auth } from '@/auth';
import { ElementalEssencesRepository } from '@/repositories/elemental-essences.repository';
import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

/**
 * GET /api/essences - Get current essences data for the authenticated user
 */
export async function GET(_req: NextRequest) {
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
    // Try supabaseId first, then fall back to walletAddress, then id
    const userId = session.user.supabaseId || session.user.walletAddress || session.user.id;

    // Cache essences data fetch for 3 seconds
    const getUserEssencesCached = unstable_cache(
      async (userWalletId: string) => {
        // Initialize essences repository
        const essencesRepo = new ElementalEssencesRepository();

        // Get user's essences data
        return await essencesRepo.getUserEssences(userWalletId);
      },
      [`essences-data-${userId}`],
      { revalidate: 3 } // Cache for 3 seconds
    );

    // Get essences data from cache or database
    const essencesData = await getUserEssencesCached(userId);

    if (!essencesData) {
      return NextResponse.json(
        { error: 'Essences data not found' },
        { status: 404 }
      );
    }

    // Return essences data with cache control headers
    const response = NextResponse.json({
      rockEssence: essencesData.rockEssence,
      paperEssence: essencesData.paperEssence,
      scissorsEssence: essencesData.scissorsEssence
    });

    // Add cache control headers
    response.headers.set('Cache-Control', 'public, max-age=2, s-maxage=3');

    return response;
  } catch (error) {
    console.error('Error in essences GET route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}