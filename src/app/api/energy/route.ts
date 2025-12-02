import { auth } from '@/auth';
import { EnergyRepository } from '@/repositories/energy.repository';
import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

/**
 * GET /api/energy - Get current energy data for the authenticated user
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

    // Get wallet address from session
    const walletAddress = session.user.walletAddress || session.user.id;

    // Cache energy data fetch for 3 seconds
    const getUserEnergyCached = unstable_cache(
      async (userWalletAddress: string) => {
        // Initialize energy repository
        const energyRepo = new EnergyRepository();

        // Get user's energy data
        return await energyRepo.getUserEnergy(userWalletAddress);
      },
      [`energy-data-${walletAddress}`],
      { revalidate: 3 } // Cache for 3 seconds
    );

    // Get energy data from cache or database
    const energyData = await getUserEnergyCached(walletAddress);

    if (!energyData) {
      return NextResponse.json(
        { error: 'Energy data not found' },
        { status: 404 }
      );
    }

    // Calculate time until next energy
    let timeUntilNextEnergy = null;

    if (
      energyData.lastRefreshedAt &&
      energyData.energyAmount < energyData.maxEnergy
    ) {
      // Convert lastRefreshedAt to Date if it's a string
      const lastRefreshedDate = typeof energyData.lastRefreshedAt === 'string'
        ? new Date(energyData.lastRefreshedAt)
        : energyData.lastRefreshedAt;

      const nextEnergyTime = new Date(
        lastRefreshedDate.getTime() +
        (energyData.energyReplenishRate * 60 * 1000)
      );

      timeUntilNextEnergy = Math.max(0, nextEnergyTime.getTime() - Date.now());
    }

    // Return energy data with cache control headers
    const response = NextResponse.json({
      energyAmount: energyData.energyAmount,
      maxEnergy: energyData.maxEnergy,
      timeUntilNextEnergy,
      replenishRate: energyData.energyReplenishRate
    });

    // Add cache control headers
    response.headers.set('Cache-Control', 'public, max-age=2, s-maxage=3');

    return response;
  } catch (error) {
    console.error('Error in energy GET route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}