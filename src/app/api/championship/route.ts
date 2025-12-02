'use server';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { LeaderboardEntry, SeasonalChampionshipRepository } from '@/repositories';
import { unstable_cache } from 'next/cache';

// Cache the championship data fetch for 5 seconds
const getCachedChampionshipData = unstable_cache(
  async (userId: string) => {
    // Create repository instance
    const repository = new SeasonalChampionshipRepository();

    // Get current season
    const currentSeason = await repository.getCurrentSeason();

    if (!currentSeason) {
      return {
        currentSeason: null,
        playerStats: null,
        leaderboard: [],
        playerRank: null,
        neighborhoodPlayers: []
      };
    }

    // Get player stats
    let playerStats = null;
    try {
      playerStats = await repository.getPlayerSeasonStats(userId, currentSeason.id);
    } catch (_statsError) {
      // Error fetching player stats in API (cached)

      // Provide default player stats on error
      playerStats = {
        id: 'default',
        playerId: userId,
        seasonId: currentSeason.id,
        points: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        winStreak: 0,
        participationDays: 0,
        hasEntryTicket: false,
        reserveEnergy: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    // Get leaderboard
    let leaderboard: LeaderboardEntry[] = [];
    try {
      leaderboard = await repository.getCurrentSeasonLeaderboard(10, 0);
      // API fetched leaderboard entries
    } catch (_leaderboardError) {
      // Error fetching leaderboard in API (cached)

      // Rather than failing, continue with an empty leaderboard
      leaderboard = [];
    }

    // Get player rank
    let playerRank = null;
    try {
      playerRank = await repository.getPlayerCurrentRank(userId);
    } catch (_rankError) {
      // Error fetching player rank in API (cached)

      // Provide a default rank instead of failing
      playerRank = {
        rank: 0,
        points: 0,
        tier: 'bronze'
      };
    }

    // Get neighborhood players if player has entry ticket
    let neighborhoodPlayers: LeaderboardEntry[] = [];
    if (playerStats && playerStats.hasEntryTicket) {
      try {
        neighborhoodPlayers = await repository.getPlayersAroundInLeaderboard(
          userId,
          currentSeason.id,
          3
        );
      } catch (_neighborsError) {
        // Error fetching neighborhood players in API (cached)
        // Just use an empty array for neighborhood players on error
        neighborhoodPlayers = [];
      }
    }

    return {
      currentSeason,
      playerStats,
      leaderboard,
      playerRank,
      neighborhoodPlayers
    };
  },
  ['championship-data'],
  { revalidate: 5 } // Cache for 5 seconds
);

/**
 * GET endpoint for championship data
 */
export async function GET(_request: NextRequest) {
  try {
    // Add a guard for stack overflow detection
    const stackGuard = new Error().stack || '';
    if (stackGuard.split('auth').length > 10) {
      // Detected potential stack overflow in auth chain
      return NextResponse.json(
        { error: 'Internal server error - auth recursion detected' },
        { status: 500 }
      );
    }

    // Get session to verify authentication
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Use supabaseId from session for database operations
    const userId = session.user.supabaseId || session.user.id;

    // Use the cached data fetch function to reduce database calls
    try {
      const data = await getCachedChampionshipData(userId);

      // Return early if there's no active season
      if (!data.currentSeason) {
        return NextResponse.json({
          success: true,
          data: {
            currentSeason: null,
            playerStats: null,
            leaderboard: [],
            playerRank: null,
            neighborhoodPlayers: []
          },
          message: 'No active championship season at this time.'
        });
      }

      // Return championship data from cache with cache control headers
      const response = NextResponse.json({
        success: true,
        data
      });

      // Add cache control headers - max-age: browser cache duration, s-maxage: CDN cache duration
      response.headers.set('Cache-Control', 'public, max-age=3, s-maxage=5');

      return response;
    } catch (_cacheError) {
      // Error fetching cached championship data
      // Fall back to direct access if cache fails (should be rare)

      // Create repository instance
      const repository = new SeasonalChampionshipRepository();

      // Get current season
      const currentSeason = await repository.getCurrentSeason();

      if (!currentSeason) {
        return NextResponse.json({
          success: true,
          data: {
            currentSeason: null,
            playerStats: null,
            leaderboard: [],
            playerRank: null,
            neighborhoodPlayers: []
          },
          message: 'No active championship season at this time.'
        });
      }

      // Get player stats
      let playerStats = null;
      try {
        playerStats = await repository.getPlayerSeasonStats(userId, currentSeason.id);
      } catch (_error) {
        // Error fetching player stats (fallback)
      }

      // Attempt to get at least the leaderboard in fallback mode
      let fallbackLeaderboard: LeaderboardEntry[] = [];
      try {
        fallbackLeaderboard = await repository.getCurrentSeasonLeaderboard(10, 0);
        // API fallback fetched leaderboard entries
      } catch (_fallbackLeaderboardError) {
        // Failed to fetch leaderboard in fallback mode
      }
      
      // Return championship data from direct fetch
      return NextResponse.json({
        success: true,
        data: {
          currentSeason,
          playerStats,
          leaderboard: fallbackLeaderboard,  // Use fetched data instead of empty array
          playerRank: null, // Simplified in fallback mode
          neighborhoodPlayers: [] // Simplified in fallback mode
        },
        fallback: true // Indicate this is fallback data
      });
    }
  } catch (error) {
    // Error in championship API route
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for championship operations
 */
export async function POST(request: NextRequest) {
  try {
    // Add a guard for stack overflow detection
    const stackGuard = new Error().stack || '';
    if (stackGuard.split('auth').length > 10) {
      // Detected potential stack overflow in auth chain
      return NextResponse.json(
        { error: 'Internal server error - auth recursion detected' },
        { status: 500 }
      );
    }

    // Get session to verify authentication
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Use supabaseId from session for database operations
    const userId = session.user.supabaseId || session.user.id;
    
    // Parse request body
    const data = await request.json();
    const { action, seasonId, size } = data;
    
    // Create repository instance
    const repository = new SeasonalChampionshipRepository();
    
    // Handle different actions
    if (action === 'purchase_entry_ticket') {
      // Entry ticket cost - 15 of each essence
      const essenceCost = {
        rock: 15,
        paper: 15,
        scissors: 15
      };
      
      // Purchase entry ticket
      try {
        const success = await repository.purchaseEntryTicket(
          userId,
          seasonId,
          essenceCost
        );
        
        return NextResponse.json({
          success,
          message: success ? 'Entry ticket purchased successfully' : 'Failed to purchase entry ticket'
        });
      } catch (ticketError) {
        // Error purchasing entry ticket
        return NextResponse.json({
          success: false,
          error: 'Error purchasing entry ticket',
          message: ticketError instanceof Error ? ticketError.message : 'Unknown error'
        }, { status: 500 });
      }
    } else if (action === 'purchase_reserve_energy') {
      // Energy amounts and costs
      const energyPacks = {
        small: {
          amount: 50,
          cost: { rock: 15, paper: 15, scissors: 15 }, // 45 essence total = $0.99
          type: 'reserve_energy_small' as const
        },
        medium: {
          amount: 150,
          cost: { rock: 30, paper: 30, scissors: 30 }, // 90 essence total = $1.99
          type: 'reserve_energy_medium' as const
        },
        large: {
          amount: 300,
          cost: { rock: 45, paper: 45, scissors: 45 }, // 135 essence total = $2.99
          type: 'reserve_energy_large' as const
        }
      };
      
      if (!size || !energyPacks[size as keyof typeof energyPacks]) {
        return NextResponse.json(
          { error: 'Invalid energy pack size' },
          { status: 400 }
        );
      }
      
      const pack = energyPacks[size as keyof typeof energyPacks];
      
      try {
        // Purchase reserve energy
        const result = await repository.purchaseReserveEnergy(
          userId,
          seasonId,
          pack.amount,
          pack.type,
          pack.cost
        );
        
        return NextResponse.json({
          success: result.success,
          updatedReserveEnergy: result.updatedReserveEnergy,
          message: result.success ? 
            `Reserve energy (${size}) purchased successfully` : 
            'Failed to purchase reserve energy'
        });
      } catch (energyError) {
        // Error purchasing reserve energy
        return NextResponse.json({
          success: false,
          error: 'Error purchasing reserve energy',
          message: energyError instanceof Error ? energyError.message : 'Unknown error'
        }, { status: 500 });
      }
    } else if (action === 'add_points') {
      const { points, isWin } = data;
      
      // Allow zero points for losses - we still need to update games played
      // Only reject negative points
      if (typeof points !== 'number' || points < 0) {
        return NextResponse.json(
          { error: 'Invalid points value' },
          { status: 400 }
        );
      }
      
      try {
        // Add points
        const result = await repository.addPoints(
          userId,
          seasonId,
          points,
          isWin === true
        );
        
        return NextResponse.json({
          success: result.success,
          updatedPoints: result.updatedPoints,
          updatedStats: result.updatedStats,
          message: result.success ? 
            `${points} points added successfully` : 
            'Failed to add points'
        });
      } catch (pointsError) {
        // Error adding points
        return NextResponse.json({
          success: false,
          error: 'Error adding points',
          message: pointsError instanceof Error ? pointsError.message : 'Unknown error'
        }, { status: 500 });
      }
    } else if (action === 'use_reserve_energy') {
      const { amount } = data;
      
      if (typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json(
          { error: 'Invalid amount value' },
          { status: 400 }
        );
      }
      
      try {
        // Use reserve energy
        const result = await repository.useReserveEnergy(
          userId,
          seasonId,
          amount
        );
        
        return NextResponse.json({
          success: result.success,
          remainingReserveEnergy: result.remainingReserveEnergy,
          message: result.success ? 
            `${amount} reserve energy used successfully` : 
            'Failed to use reserve energy'
        });
      } catch (useEnergyError) {
        // Error using reserve energy
        return NextResponse.json({
          success: false,
          error: 'Error using reserve energy',
          message: useEnergyError instanceof Error ? useEnergyError.message : 'Unknown error'
        }, { status: 500 });
      }
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid action',
          message: `Action '${action}' is not supported`
        },
        { status: 400 }
      );
    }
  } catch (error) {
    // Error in championship API route
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}